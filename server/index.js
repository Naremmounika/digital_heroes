import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import supabase from "./config/supabase.js";
import authMiddleware from "./middleware/auth.js";


const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          role: "user",
        },
      ])
      .select();

    if (error) return res.status(400).json(error);

    res.json({ message: "User registered", user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: users } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (!users || users.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/profile", authMiddleware, async (req, res) => {
  res.json({
    message: "Protected route",
    user: req.user,
  });
});

app.post("/add-score", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { score, date } = req.body;

    if (score < 1 || score > 45) {
      return res.status(400).json({ message: "Score must be between 1 and 45" });
    }

    const { data: existing } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date);

    if (existing.length > 0) {
      return res.status(400).json({ message: "Score for this date already exists" });
    }

    const { data: scores } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (scores.length >= 5) {
      const oldest = scores[0];
      await supabase.from("scores").delete().eq("id", oldest.id);
    }

    const { data, error } = await supabase
      .from("scores")
      .insert([
        {
          user_id: userId,
          score,
          date,
        },
      ])
      .select();

    if (error) return res.status(400).json(error);

    res.json({
      message: "Score added successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/scores", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) return res.status(400).json(error);

    res.json({ scores: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/draw", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    let { numbers, month } = req.body;

    if (!numbers) {
      numbers = [];
      while (numbers.length < 5) {
        const num = Math.floor(Math.random() * 45) + 1;
        if (!numbers.includes(num)) numbers.push(num);
      }
    }

    if (!Array.isArray(numbers) || numbers.length !== 5) {
      return res.status(400).json({ message: "Provide exactly 5 numbers" });
    }

    if (!month) {
      month = new Date().toISOString().slice(0, 7);
    }

    const { data, error } = await supabase
      .from("draws")
      .insert([
        {
          month,
          numbers,
          type: "random",
          published: false,
        },
      ])
      .select();

    if (error) return res.status(400).json(error);

    res.json({
      message: "Draw created",
      draw: data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/run-draw", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data: drawData } = await supabase
      .from("draws")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    const draw = drawData[0];

    let drawNumbers = draw.numbers;

    if (typeof drawNumbers === "string") {
      drawNumbers = JSON.parse(drawNumbers);
    }

    const { data: users } = await supabase.from("users").select("*");

    let winnersList = [];

    for (let user of users) {
      const { data: scores } = await supabase
        .from("scores")
        .select("score")
        .eq("user_id", user.id);

      let matchCount = 0;

      for (let s of scores) {
        const scoreVal = Number(s.score);

        if (drawNumbers.includes(scoreVal)) {
          matchCount++;
        }
      }
      if (matchCount >= 3) {
        const { data } = await supabase.from("winners").insert([
          {
            user_id: user.id,
            draw_id: draw.id,
            match_type: matchCount.toString(),
            amount: 0,
            status: "pending",
          },
        ]);

        winnersList.push({
          user: user.email,
          match: matchCount,
        });
      }
    }

    res.json({
      message: "Draw executed",
      winners: winnersList,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/distribute-prize", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data: drawData } = await supabase
      .from("draws")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    const draw = drawData[0];

    const { data: winners } = await supabase
      .from("winners")
      .select("*")
      .eq("draw_id", draw.id);

    if (!winners || winners.length === 0) {
      return res.json({ message: "No winners for this draw" });
    }

    const { data: users } = await supabase.from("users").select("*");

    const totalPool = users.length * 100;

    const pool5 = totalPool * 0.4;
    const pool4 = totalPool * 0.35;
    const pool3 = totalPool * 0.25;

    const winners5 = winners.filter(w => w.match_type === "5");
    const winners4 = winners.filter(w => w.match_type === "4");
    const winners3 = winners.filter(w => w.match_type === "3");

    const updateWinnerAmount = async (group, pool) => {
      if (group.length === 0) return;

      const share = pool / group.length;

      for (let w of group) {
        await supabase
          .from("winners")
          .update({ amount: share })
          .eq("id", w.id);
      }
    };

    await updateWinnerAmount(winners5, pool5);
    await updateWinnerAmount(winners4, pool4);
    await updateWinnerAmount(winners3, pool3);

    res.json({
      message: "Prize distributed",
      totalPool,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
app.post("/charity", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { name, description, image_url } = req.body;

    const { data, error } = await supabase
      .from("charities")
      .insert([
        {
          name,
          description,
          image_url,
        },
      ])
      .select();
    if (error) return res.status(400).json(error);

    res.json({ message: "Charity created", data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/charities", async (req, res) => {
  const { data, error } = await supabase
    .from("charities")
    .select("*");

  if (error) return res.status(400).json(error);

  res.json({ charities: data });
});
app.post("/select-charity", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { charity_id, percent } = req.body;

    if (percent < 10) {
      return res.status(400).json({ message: "Minimum 10% required" });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        charity_id,
        charity_percent: percent,
      })
      .eq("id", userId)
      .select();

    if (error) return res.status(400).json(error);

    res.json({ message: "Charity selected", data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/overview", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data: users } = await supabase.from("users").select("*");
    const { data: scores } = await supabase.from("scores").select("*");
    const { data: draws } = await supabase.from("draws").select("*");
    const { data: winners } = await supabase.from("winners").select("*");
    const { data: charities } = await supabase.from("charities").select("*");

    res.json({
      totalUsers: users.length,
      totalScores: scores.length,
      totalDraws: draws.length,
      totalWinners: winners.length,
      totalCharities: charities.length,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/admin/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*");

    if (error) return res.status(400).json(error);

    res.json({ users: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/admin/winners", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data, error } = await supabase
      .from("winners")
      .select("*");

    if (error) return res.status(400).json(error);

    res.json({ winners: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/admin/draws", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data, error } = await supabase
      .from("draws")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json(error);

    res.json({ draws: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});