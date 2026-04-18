import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard() {
  const [scores, setScores] = useState([]);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const [score, setScore] = useState("");
  const [date, setDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [drawNumbers, setDrawNumbers] = useState(null);

  useEffect(() => {
    let ignore = false;

    const fetchData = async () => {
      try {
        const profileRes = await api.get("/profile");
        const scoresRes = await api.get("/scores");

        if (!ignore) {
          setUser(profileRes.data.user);
          setScores(scoresRes.data.scores);
        }
      } catch (err) {
        console.log(err);
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const refreshScores = async () => {
    const res = await api.get("/scores");
    setScores(res.data.scores);
  };

  const addScore = async () => {
    try {
      await api.post("/add-score", {
        score: Number(score),
        date,
      });

      setScore("");
      setDate("");
      refreshScores();
    } catch (err) {
      console.log(err);
    }
  };

   const runDraw = async () => {
  try {
    setLoading(true);
    setMessage("");

    const res = await api.post("/draw");

    const numbers =
      res.data?.draw?.[0]?.numbers ||
      res.data?.draw?.numbers ||
      res.data?.numbers ||
      [];

    setDrawNumbers(numbers);

    setMessage("Draw generated successfully");
  } catch (err) {
    console.log(err);

    setMessage(
      err.response?.data?.message || "Draw failed or access denied"
    );
  } finally {
    setLoading(false);
  }
};

  const distributePrize = async () => {
    try {
      await api.post("/distribute-prize");
      alert("Prize distributed successfully");
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="container">

      <h1>Dashboard</h1>

      {/* USER INFO */}
      <div className="cardRow">
        <div className="card">
          <h3>User</h3>
          <h2>{user?.name || "Loading..."}</h2>
        </div>

        <div className="card">
          <h3>Role</h3>
          <h2>{user?.role || "-"}</h2>
        </div>

        <div className="card">
          <h3>Total Scores</h3>
          <h2>{scores.length}</h2>
        </div>
      </div>

      {/* ADD SCORE */}
      <div className="list">
        <h2>Add Score</h2>

        <input
          className="input"
          placeholder="Score (1-45)"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />

        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <button className="button" onClick={addScore}>
          Add Score
        </button>
      </div>

      {/* SCORES */}
      <div className="list">
        <h2>Your Scores</h2>

        {scores.map((s, i) => (
          <div className="row" key={i}>
            {s.date} → {s.score}
          </div>
        ))}
      </div>

      {/* DRAW */}
      <div className="list">
        <h2>Draw System</h2>
         {message && <p className="message">{message}</p>}
        <button className="button" onClick={runDraw}>
          Run Draw
        </button>

        {loading && <p>Generating draw...</p>}

        {drawNumbers && (
          <div className="row">
            Winning Numbers: {JSON.stringify(drawNumbers)}
          </div>
        )}
      </div>

      {/* ADMIN */}
      <div className="list">
        <h2>Admin Actions</h2>

        <button className="button" onClick={distributePrize}>
          Distribute Prize
        </button>
      </div>

    </div>
  );
}