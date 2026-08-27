import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getLocalAccount, saveLocalAccount } from "../util/accountStore";

const DEMO_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@disasterconnect.org",
    pass: "password",
    badge: "Admin",
    bg: "rgba(99,102,241,0.12)",
    color: "#6366f1",
  },
  {
    role: "Senior Moderator",
    email: "senior.mod@disasterconnect.org",
    pass: "password",
    badge: "Senior Mod",
    bg: "rgba(99,102,241,0.12)",
    color: "#6366f1",
  },
  {
    role: "Student Moderator (Trusted)",
    email: "student_mod@disasterconnect.org",
    pass: "password",
    badge: "Student Mod",
    bg: "rgba(16,185,129,0.12)",
    color: "#10b981",
  },
  {
    role: "Student Moderator (Verified)",
    email: "priya.mod@disasterconnect.org",
    pass: "password",
    badge: "Student Mod",
    bg: "rgba(20,184,166,0.12)",
    color: "#14b8a6",
  },
  {
    role: "NGO / Relief Org",
    email: "ndrc-relief@disasterconnect.org",
    pass: "password",
    badge: "NGO",
    bg: "rgba(245,158,11,0.12)",
    color: "#f59e0b",
  },
  {
    role: "Citizen",
    email: "rahul.citizen@example.com",
    pass: "password",
    badge: "Citizen",
    bg: "rgba(107,114,128,0.12)",
    color: "#6b7280",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function getRedirectPath(role) {
    if (role === "admin") return "/admin/moderator-applications";
    if (["student_moderator", "senior_moderator", "moderator"].includes(role)) return "/moderator";
    if (role === "ngo") return "/ngo";
    return "/";
  }

  async function performLogin(targetEmail, targetPassword) {
    setError(null);
    setBusy(true);

    try {
      const data = await api.login({ email: targetEmail, password: targetPassword });
      saveLocalAccount({ email: targetEmail, password: targetPassword, user: data.user, token: data.token });
      login(data.token, data.user);
      navigate(getRedirectPath(data.user.role));
    } catch (err) {
      // Check local saved account store if Vercel serverless container recycled memory
      const localAcc = getLocalAccount(targetEmail, targetPassword);
      if (localAcc) {
        login(localAcc.token, localAcc.user);
        navigate(getRedirectPath(localAcc.user.role));
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();
    performLogin(email, password);
  }

  function handleDemoClick(demoEmail, demoPass) {
    setEmail(demoEmail);
    setPassword(demoPass);
    performLogin(demoEmail, demoPass);
  }

  return (
    <div className="auth-page" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>
            DisasterConnect
          </p>
          <h1 style={{ margin: "0 0 4px 0" }}>Log in to your account</h1>
          <p className="auth-card__sub" style={{ margin: 0 }}>
            Access your incident feed, reports, and role dashboard.
          </p>
        </div>

        {/* Demo Credentials Box */}
        <div style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ⚡ 1-Click Quick Demo Logins
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Click any account to login instantly</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={busy}
                onClick={() => handleDemoClick(acc.email, acc.pass)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: email === acc.email ? `1.5px solid ${acc.color}` : "1px solid var(--border)",
                  background: email === acc.email ? acc.bg : "var(--bg-card)",
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "all 0.12s ease",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)" }}>{acc.role}</span>
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {acc.email}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--primary)", fontWeight: 600, marginTop: 2 }}>
                  Click to log in →
                </div>
              </button>
            ))}
          </div>
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

