import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleSignup = async () => {
    await api.post("/signup", { name, email, password });
    navigate("/login");
  };

  return (
    <div className="container">
      <h1>Signup</h1>

      <input className="input" placeholder="Name" onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

      <button className="button" onClick={handleSignup}>Signup</button>
    </div>
  );
}