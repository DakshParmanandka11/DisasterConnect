import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useGeolocation } from "../hooks/useGeolocation";
import MapPicker from "../components/MapPicker";
import { saveLocalAccount, isLocalEmailRegistered } from "../util/accountStore";

const ROLES = [
  {
    id: "citizen",
    label: "Citizen",
    desc: "Report incidents in your area and help verify nearby disaster reports through community upvotes.",
  },
  {
    id: "ngo",
    label: "NGO / Relief Organisation",
    desc: "Manage your relief operations, respond to verified incidents, and receive NGO dispatch alerts.",
  },
];

export default function Register() {
  const [role, setRole] = useState("citizen");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [serviceRadius, setServiceRadius] = useState(25);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const geo = useGeolocation();
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (isLocalEmailRegistered(email)) {
      setError("An account with this email address already exists. Please log in instead.");
      return;
    }

    if (role === "ngo" && !geo.coords) {
      setError("Set your organisation's service location on the map before continuing.");
      return;
    }
    setBusy(true);

    try {
      const payload = {
        name, email, password, role,
        home_lat: geo.coords?.lat,
        home_lng: geo.coords?.lng,
        org_name: role === "ngo" ? orgName : undefined,
        service_radius_km: role === "ngo" ? Number(serviceRadius) : undefined,
      };
      const data = await api.register(payload);

      // Save locally to persist credentials across serverless restarts
      saveLocalAccount({ email, password, user: data.user, token: data.token });
      login(data.token, data.user);
      navigate(role === "ngo" ? "/ngo" : role === "moderator" ? "/moderator" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>
            DisasterConnect
          </p>
          <h1 style={{ margin: "0 0 4px 0" }}>Create an account</h1>
          <p className="auth-card__sub">
            Select your role to get started. You can't change your role after registration.
          </p>
          <div style={{ background: "var(--primary-bg)", border: "1px solid var(--primary-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Want to join as a <strong style={{ color: "var(--primary)" }}>Student Moderator</strong>? Register as a citizen first, then <Link to="/moderator/apply" style={{ color: "var(--primary)", fontWeight: 600 }}>apply to the moderation programme →</Link>
          </div>
        </div>

        {/* Role selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                border: role === r.id ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                background: role === r.id ? "var(--primary-bg)" : "transparent",
                cursor: "pointer",
                transition: "all var(--transition)",
                textAlign: "left",
              }}
            >
              <span style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: role === r.id ? "4px solid var(--primary)" : "2px solid var(--border)",
                background: "transparent",
                flexShrink: 0,
                marginTop: 2,
                transition: "all var(--transition)",
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: role === r.id ? "var(--primary)" : "var(--text-primary)" }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, marginTop: 2 }}>
                  {r.desc}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="reg-name">{role === "ngo" ? "Contact name" : "Full name"}</label>
            <input id="reg-name" required autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email address</label>
            <input id="reg-email" type="email" required autoComplete="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" type="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {role === "ngo" && (
            <>
              <div className="field">
                <label htmlFor="reg-orgname">Organisation name</label>
                <input id="reg-orgname" required placeholder="e.g. Red Cross — Delhi Chapter" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="reg-radius">Service radius (km)</label>
                <input id="reg-radius" type="number" min={1} max={200} value={serviceRadius} onChange={(e) => setServiceRadius(e.target.value)} />
              </div>
              <div className="field">
                <label>Base location</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => geo.request()} style={{ marginBottom: 8, alignSelf: "flex-start" }}>
                  {geo.loading ? "Locating…" : "Use my current location"}
                </button>
                <MapPicker lat={geo.coords?.lat} lng={geo.coords?.lng} onPick={geo.setCoords} radiusKm={Number(serviceRadius)} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                  Click the map or use the button above to set your organisation's base location.
                </p>
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            style={{ width: "100%", padding: "9px", marginTop: 6 }}
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-card__footer">
          Already registered? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
