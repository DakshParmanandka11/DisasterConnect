import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
  pending:           { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  under_review:      { color: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
  training_required: { color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  approved:          { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  rejected:          { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  suspended:         { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export default function AdminApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!["admin", "senior_moderator"].includes(user.role)) { navigate("/"); return; }
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminGetApplications();
      setApplications(data.applications || []);
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

  async function approve(id) {
    setBusy((p) => ({ ...p, [id]: "approve" }));
    try {
      const data = await api.adminApproveApplication(id);
      showFeedback(data.message);
      setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: "approved" } : a));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((p) => ({ ...p, [id]: null }));
    }
  }

  async function reject(id) {
    if (!rejectReason) { setError("Please enter a rejection reason."); return; }
    setBusy((p) => ({ ...p, [id]: "reject" }));
    try {
      await api.adminRejectApplication(id, rejectReason);
      showFeedback("Application rejected.");
      setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected" } : a));
      setRejectReason("");
      setExpanded(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((p) => ({ ...p, [id]: null }));
    }
  }

  async function requestTraining(id) {
    setBusy((p) => ({ ...p, [id]: "training" }));
    try {
      await api.adminRequestTraining(id);
      showFeedback("Training required status set.");
      setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: "training_required" } : a));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((p) => ({ ...p, [id]: null }));
    }
  }

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 0" }}>Admin Panel</p>
          <h1 style={{ margin: 0 }}>Moderator Applications</h1>
        </div>
        <Link to="/admin/moderators" className="btn btn-outline btn-sm">Moderator Management →</Link>
      </div>

      {feedback && (
        <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: "0.9rem" }}>
          {feedback}
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total", count: applications.length, status: "all" },
          { label: "Pending", count: applications.filter((a) => a.status === "pending").length, status: "pending" },
          { label: "Approved", count: applications.filter((a) => a.status === "approved").length, status: "approved" },
          { label: "Rejected", count: applications.filter((a) => a.status === "rejected").length, status: "rejected" },
        ].map((s) => {
          const sc = STATUS_COLORS[s.status] || { color: "var(--text-primary)", bg: "var(--bg-card-alt)" };
          return (
            <button
              key={s.status}
              onClick={() => setFilter(s.status)}
              style={{
                background: filter === s.status ? sc.bg : "var(--bg-card)",
                border: filter === s.status ? `1px solid ${sc.color}40` : "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 16px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{s.label}</div>
              <div style={{ fontWeight: 800, fontSize: "1.4rem", color: filter === s.status ? sc.color : "var(--text-primary)" }}>{s.count}</div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          No applications found for filter: {filter}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((app) => {
            const sc = STATUS_COLORS[app.status] || STATUS_COLORS.pending;
            const isExpanded = expanded === app.id;
            const isBusy = busy[app.id];

            return (
              <div key={app.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <div
                  style={{ padding: "16px 20px", display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", cursor: "pointer" }}
                  onClick={() => setExpanded(isExpanded ? null : app.id)}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <strong style={{ fontSize: "0.95rem" }}>{app.full_name}</strong>
                      <span style={{ background: sc.bg, color: sc.color, padding: "1px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>
                        {app.status.replace("_", " ")}
                      </span>
                      {app.training_completed && (
                        <span style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", padding: "1px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.72rem", fontWeight: 600 }}>
                          Training ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {app.college} · {app.course} · {app.academic_year} · {app.city}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Applied: {new Date(app.created_at).toLocaleDateString()} · {app.user_email}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {app.status === "pending" && user.role === "admin" && (
                      <>
                        <button
                          className="btn btn-sm"
                          disabled={!!isBusy}
                          onClick={(e) => { e.stopPropagation(); approve(app.id); }}
                          style={{ background: "#10b981", color: "#fff", border: "none" }}
                        >
                          {isBusy === "approve" ? "…" : "Approve"}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={!!isBusy}
                          onClick={(e) => { e.stopPropagation(); requestTraining(app.id); }}
                        >
                          {isBusy === "training" ? "…" : "Request Training"}
                        </button>
                        <button
                          className="btn btn-sm"
                          disabled={!!isBusy}
                          onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : app.id); }}
                          style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.25)" }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", alignSelf: "center" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border-muted)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginTop: 16, marginBottom: 16, fontSize: "0.88rem" }}>
                      {[
                        ["Student ID", app.student_id],
                        ["College Email", app.college_email],
                        ["Phone", app.phone],
                        ["Preferred Hours", app.preferred_hours],
                      ].map(([k, v]) => (
                        <div key={k}><span style={{ color: "var(--text-muted)" }}>{k}: </span><strong>{v}</strong></div>
                      ))}
                    </div>

                    <div style={{ background: "var(--bg-card-alt)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 16 }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Reason for applying</div>
                      <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.7 }}>{app.reason}</p>
                    </div>

                    {app.status === "pending" && user.role === "admin" && (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          type="text"
                          placeholder="Rejection reason (required)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "7px 10px", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.88rem" }}
                        />
                        <button
                          className="btn btn-sm"
                          style={{ background: "var(--red)", color: "#fff", border: "none" }}
                          onClick={() => reject(app.id)}
                          disabled={!rejectReason || !!busy[app.id]}
                        >
                          Confirm Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
