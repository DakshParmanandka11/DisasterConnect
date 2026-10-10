import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import SignalMeter from "../components/SignalMeter";

const POLL_MS = 30000;
const SEVERITY_RANK = { critical: 3, high: 2, moderate: 1, low: 0 };
const RESPONSE = {
  new: { label: "New", bg: "var(--red-bg)", fg: "var(--red)" },
  acknowledged: { label: "Acknowledged", bg: "var(--amber-bg)", fg: "var(--amber)" },
  responding: { label: "Responding", bg: "var(--intel-muted)", fg: "var(--primary)" },
  resolved: { label: "Resolved", bg: "var(--green-bg)", fg: "var(--green)" },
};
// Next action offered for each state (forward-only, enforced again by the server).
const NEXT = {
  new: [{ to: "acknowledged", label: "Acknowledge" }, { to: "responding", label: "Start responding" }],
  acknowledged: [{ to: "responding", label: "Start responding" }, { to: "resolved", label: "Mark resolved" }],
  responding: [{ to: "resolved", label: "Mark resolved" }],
  resolved: [],
};
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

export default function NGODashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filters, setFilters] = useState({ status: "open", category: "all", maxKm: "all" });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    api.ngoNotifications()
      .then((d) => { setData(d); setError(null); setUpdatedAt(new Date()); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS); // simple polling; no socket server exists in this build
    return () => clearInterval(t);
  }, [load]);

  async function act(n, to) {
    setBusyId(n.notification_id);
    setActionError(null);
    try {
      await api.ngoSetResponse(n.notification_id, to, (notes[n.notification_id] || "").trim());
      load();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const items = useMemo(() => {
    const list = (data?.notifications || []).filter((n) => {
      if (filters.status === "open" && n.response_status === "resolved") return false;
      if (!["open", "all"].includes(filters.status) && n.response_status !== filters.status) return false;
      if (filters.category !== "all" && n.category !== filters.category) return false;
      if (filters.maxKm !== "all" && (n.distance_km == null || n.distance_km > Number(filters.maxKm))) return false;
      return true;
    });
    const order = { new: 0, acknowledged: 1, responding: 2, resolved: 3 };
    return list.sort((a, b) =>
      order[a.response_status] - order[b.response_status] ||
      (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) ||
      new Date(b.notified_at) - new Date(a.notified_at));
  }, [data, filters]);

  if (error && !data) return <div className="container" style={{ paddingTop: 40 }}><div className="error-banner">{error}</div></div>;
  if (!data) return <div className="container" style={{ paddingTop: 40, color: "var(--text-muted)", fontSize: 13 }}>Loading NGO dashboard…</div>;

  const all = data.notifications || [];
  const counts = { new: 0, acknowledged: 0, responding: 0, resolved: 0 };
  all.forEach((n) => { counts[n.response_status] = (counts[n.response_status] || 0) + 1; });
  const categories = [...new Set(all.map((n) => n.category))];
  const approved = data.ngo?.verification_status === "approved";

  return (
    <div className="container" style={{ maxWidth: 900, paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 0" }}>NGO Action Center</p>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 4px 0" }}>{data.ngo?.org_name || "Relief Command Centre"}</h1>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
          Community-verified incidents within <strong style={{ color: "var(--primary)" }}>{data.ngo?.service_radius_km || 25} km</strong> of your service zone ·
          {" "}last refreshed {updatedAt ? updatedAt.toLocaleTimeString() : "—"} (auto-refresh every {POLL_MS / 1000}s)
        </p>
        {!approved && (
          <div className="error-banner" style={{ marginTop: 10 }}>
            Your organisation is <strong>{data.ngo?.verification_status || "pending"}</strong> administrator approval. You will not receive alerts until approved.
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {Object.entries(RESPONSE).map(([k, v]) => (
          <button key={k} className="card" onClick={() => setFilters((f) => ({ ...f, status: k }))}
            style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer", border: filters.status === k ? `2px solid ${v.fg}` : undefined }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: v.fg }}>{counts[k] || 0}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{v.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
        <label>Status{" "}
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="open">Open (not resolved)</option>
            <option value="all">All</option>
            {Object.entries(RESPONSE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label>Category{" "}
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="all">All</option>
            {categories.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
        </label>
        <label>Within{" "}
          <select value={filters.maxKm} onChange={(e) => setFilters({ ...filters, maxKm: e.target.value })}>
            <option value="all">Any distance</option>
            {[10, 25, 50].map((k) => <option key={k} value={k}>{k} km</option>)}
          </select>
        </label>
      </div>

      {actionError && <div className="error-banner" style={{ marginBottom: 10 }}>{actionError}</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {all.length === 0 ? "No community-verified incidents have been routed to your organisation yet." : "No incidents match these filters."}
          </div>
        ) : items.map((n) => {
          const st = RESPONSE[n.response_status] || RESPONSE.new;
          const busy = busyId === n.notification_id;
          return (
            <div key={n.notification_id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", background: n.response_status === "new" ? "rgba(239,68,68,0.04)" : "var(--bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="tag">{String(n.category).replace("_", " ")}</span>
                    <span className="tag" style={{ textTransform: "capitalize" }}>{n.severity}</span>
                    <span style={{ background: st.bg, color: st.fg, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                    <span className="tag">{n.moderation_status === "COMMUNITY_VERIFIED" ? "Community verified" : String(n.moderation_status).replace(/_/g, " ").toLowerCase()}</span>
                  </div>
                  <Link to={`/report/${n.id}`} style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{n.title}</Link>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6 }}>
                    {n.distance_km != null ? `${n.distance_km} km from your service centre · ` : ""}
                    {Number(n.lat).toFixed(4)}, {Number(n.lng).toFixed(4)}<br />
                    Alerted {when(n.notified_at)} · In-app alert (no SMS/email is sent by this system)<br />
                    Response last updated {when(n.response_updated_at)}
                  </div>
                  {n.response_note && <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-body)" }}>Your note: {n.response_note}</div>}
                </div>
                <div style={{ width: 170, flexShrink: 0 }}>
                  <SignalMeter pct={n.upvotePct} totalVotes={n.totalVotes} size="sm" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                {approved && NEXT[n.response_status]?.length > 0 && (
                  <input
                    type="text" maxLength={500} placeholder="Optional note (resources, ETA…)"
                    value={notes[n.notification_id] || ""}
                    onChange={(e) => setNotes({ ...notes, [n.notification_id]: e.target.value })}
                    style={{ flex: "1 1 200px", minWidth: 160, fontSize: 13 }}
                  />
                )}
                {approved && (NEXT[n.response_status] || []).map((a, i) => (
                  <button key={a.to} disabled={busy} className={`btn btn-sm ${i === 0 ? "btn-primary" : "btn-outline"}`} onClick={() => act(n, a.to)}>
                    {busy ? "Saving…" : a.label}
                  </button>
                ))}
                <Link className="btn btn-outline btn-sm" to={`/report/${n.id}`}>Incident &amp; map ↗</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
