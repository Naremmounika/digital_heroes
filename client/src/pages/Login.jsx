import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    const res = await api.post("/login", { email, password });

    localStorage.setItem("token", res.data.token);

    navigate("/dashboard");
  };

  return (
    <div className="container">
      <h1>Login</h1>

      <input className="input" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

      <button className="button" onClick={handleLogin}>Login</button>
    </div>
  );
}