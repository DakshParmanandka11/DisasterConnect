import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useGeolocation } from "../hooks/useGeolocation";
import MapPicker from "../components/MapPicker";

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

    if (role === "ngo" && !geo.coords) {
      setError("Set your organization's service location on the map (or use your current location) before continuing.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name,
        email,
        password,
        role,
        home_lat: geo.coords?.lat,
        home_lng: geo.coords?.lng,
        org_name: role === "ngo" ? orgName : undefined,
        service_radius_km: role === "ngo" ? Number(serviceRadius) : undefined,
      };
      const data = await api.register(payload);
      login(data.token, data.user);
      navigate(role === "ngo" ? "/ngo" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 40, paddingBottom: 60 }}>
      <h1>Create an account</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn btn-sm ${role === "citizen" ? "btn-trust" : "btn-outline"}`}
          onClick={() => setRole("citizen")}
        >
          Citizen Reporter
        </button>
        <button
          type="button"
          className={`btn btn-sm ${role === "ngo" ? "btn-trust" : "btn-outline"}`}
          onClick={() => setRole("ngo")}
        >
          NGO / Relief Org
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>{role === "ngo" ? "Contact Name" : "Full Name"}</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {role === "ngo" && (
          <>
            <div className="field">
              <label>Organization Name</label>
              <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div className="field">
              <label>Service Radius (km)</label>
              <input
                type="number"
                min={1}
                max={200}
                value={serviceRadius}
                onChange={(e) => setServiceRadius(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Service Area Location</label>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => geo.request()} style={{ marginBottom: 10 }}>
                {geo.loading ? "Locating..." : "Use my current location"}
              </button>
              <MapPicker
                lat={geo.coords?.lat}
                lng={geo.coords?.lng}
                onPick={geo.setCoords}
                radiusKm={Number(serviceRadius)}
              />
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                Click the map to set your organization's base location, or use your current location.
              </p>
            </div>
          </>
        )}

        <button className="btn btn-signal" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
