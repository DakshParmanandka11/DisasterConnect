import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const LEVEL_COLORS = {
  trainee:  { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  verified: { color: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
  trusted:  { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  senior:   { color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
};

const LEVELS = ["trainee", "verified", "trusted", "senior"];

export default function AdminModerators() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [moderators, setModerators] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});
  const [filter, setFilter] = useState("all");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendTarget, setSuspendTarget] = useState(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!["admin", "senior_moderator"].includes(user.role)) { navigate("/"); return; }
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const [modsData, analyticsData] = await Promise.all([
        api.adminGetModerators(),
        api.adminGetAnalytics(),
      ]);
      setModerators(modsData.moderators || []);
      setAnalytics(analyticsData.analytics || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function showFeedback(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  }

  async function suspend(userId) {
    if (!suspendReason) { setError("Enter a suspension reason."); return; }
    setBusy((p) => ({ ...p, [userId]: "suspend" }));
    try {
      const data = await api.adminSuspendModerator(userId, suspendReason);
      showFeedback(data.message);
      setModerators((prev) => prev.map((m) => m.user_id === userId ? { ...m, status: "suspended" } : m));
      setSuspendTarget(null);
      setSuspendReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((p) => ({ ...p, [userId]: null }));
    }
  }

  async function reactivate(userId) {
    setBusy((p) => ({ ...p, [userId]: "reactivate" }));
    try {
      const data = await api.adminReactivateModerator(userId);
      showFeedback(data.message);
      setModerators((prev) => prev.map((m) => m.user_id === userId ? { ...m, status: "approved" } : m));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((p) => ({ ...p, [userId]: null }));
    }
  }

  async function promote(userId, level) {
    setBusy((p) => ({ ...p, [userId]: "promote" }));
    try {
      const data = await api.adminPromoteModerator(userId, level);
      showFeedback(data.message);
      setModerators((prev) => prev.map((m) => m.user_id === userId ? { ...m, level } : m));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((p) => ({ ...p, [userId]: null }));
    }
  }

  const filtered = filter === "all" ? moderators : moderators.filter((m) => m.status === filter || m.level === filter);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 0" }}>Admin Panel</p>
          <h1 style={{ margin: 0 }}>Moderator Management</h1>
        </div>
        <Link to="/admin/moderator-applications" className="btn btn-outline btn-sm">Applications →</Link>
      </div>

      {feedback && (
        <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
          {feedback}
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      {/* Analytics strip */}
      {analytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Total Reports", value: analytics.totalReports },
            { label: "Decisions Made", value: analytics.totalDecisions },
            { label: "Approval Rate", value: `${analytics.approvalRate}%` },
            { label: "Rejection Rate", value: `${analytics.rejectionRate}%` },
            { label: "Escalation Rate", value: `${analytics.escalationRate}%` },
            { label: "Active Moderators", value: analytics.activeModeratorCount },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--text-primary)" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["all", "approved", "suspended", "trainee", "verified", "trusted", "senior"].map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter(f)}
            style={{ textTransform: "capitalize" }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          No moderators found.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-card-alt)" }}>
                {["Name", "College", "Level", "Trust", "Accuracy", "Reviews", "Earnings", "Status", "Last Active", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((mod) => {
                const lc = LEVEL_COLORS[mod.level] || LEVEL_COLORS.trainee;
                const isBusy = busy[mod.user_id];
                const isSuspended = mod.status === "suspended";

                return (
                  <tr key={mod.user_id} style={{ borderBottom: "1px solid var(--border-muted)" }}>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{mod.user_name}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{mod.user_email}</div>
                    </td>
                    <td style={{ padding: "12px 12px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      {mod.college || "—"}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span style={{ background: lc.bg, color: lc.color, padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>
                        {mod.level}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", fontWeight: 700, color: mod.trust_score >= 80 ? "#10b981" : mod.trust_score >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {mod.trust_score}/100
                    </td>
                    <td style={{ padding: "12px 12px", fontWeight: 700, color: "var(--primary)" }}>
                      {(mod.accuracy || 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <div>{mod.total_reviews} total</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {mod.approvals}↑ {mod.rejections}↓ {mod.escalations}↗
                      </div>
                    </td>
                    <td style={{ padding: "12px 12px", fontWeight: 700, color: "#10b981" }}>
                      ₹{(mod.total_earned || 0).toFixed(0)}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span style={{ background: isSuspended ? "var(--red-bg)" : "rgba(16,185,129,0.12)", color: isSuspended ? "var(--red)" : "#10b981", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 600, textTransform: "capitalize" }}>
                        {mod.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {mod.last_active ? new Date(mod.last_active).toLocaleDateString() : "Never"}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {!isSuspended && user.role === "admin" && (
                          <>
                            <select
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) promote(mod.user_id, e.target.value); }}
                              disabled={!!isBusy}
                              style={{ fontSize: "0.78rem", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "3px 6px", background: "var(--bg-input)", color: "var(--text-primary)", cursor: "pointer" }}
                            >
                              <option value="">Promote…</option>
                              {LEVELS.filter((l) => l !== mod.level).map((l) => (
                                <option key={l} value={l} style={{ textTransform: "capitalize" }}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                              ))}
                            </select>
                            <button
                              className="btn btn-sm"
                              style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.75rem" }}
                              onClick={() => setSuspendTarget(mod.user_id)}
                              disabled={!!isBusy}
                            >
                              Suspend
                            </button>
                          </>
                        )}
                        {isSuspended && user.role === "admin" && (
                          <button
                            className="btn btn-sm"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.75rem" }}
                            onClick={() => reactivate(mod.user_id)}
                            disabled={!!isBusy}
                          >
                            {isBusy === "reactivate" ? "…" : "Reactivate"}
                          </button>
                        )}
                      </div>
                      {suspendTarget === mod.user_id && (
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input
                            type="text"
                            placeholder="Suspension reason"
                            value={suspendReason}
                            onChange={(e) => setSuspendReason(e.target.value)}
                            style={{ flex: 1, border: "1px solid var(--red)", borderRadius: "var(--radius-xs)", padding: "4px 8px", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.8rem" }}
                          />
                          <button
                            className="btn btn-sm"
                            style={{ background: "var(--red)", color: "#fff", border: "none", fontSize: "0.75rem" }}
                            onClick={() => suspend(mod.user_id)}
                            disabled={!suspendReason}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: "0.75rem" }}
                            onClick={() => { setSuspendTarget(null); setSuspendReason(""); }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
