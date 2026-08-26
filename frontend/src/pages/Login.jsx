import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getLocalAccount, saveLocalAccount } from "../util/accountStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const data = await api.login({ email, password });
      saveLocalAccount({ email, password, user: data.user, token: data.token });
      login(data.token, data.user);
      navigate(
        data.user.role === "ngo" ? "/ngo"
        : data.user.role === "moderator" ? "/moderator"
        : "/"
      );
    } catch (err) {
      // Check local saved account store if Vercel serverless container recycled memory
      const localAcc = getLocalAccount(email, password);
      if (localAcc) {
        login(localAcc.token, localAcc.user);
        navigate(
          localAcc.user.role === "ngo" ? "/ngo"
          : localAcc.user.role === "moderator" ? "/moderator"
          : "/"
        );
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>
            DisasterConnect
          </p>
          <h1 style={{ margin: "0 0 4px 0" }}>Log in to your account</h1>
          <p className="auth-card__sub">
            Access your incident feed, reports, and role dashboard.
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            style={{ width: "100%", padding: "9px", marginTop: 6 }}
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className="auth-card__footer">
          Don't have an account?{" "}
          <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
