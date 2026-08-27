import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./ModeratorDashboard.css";

const LEVEL_CONFIG = {
  trainee:  { label: "Trainee",  color: "#6b7280", limit: 10 },
  verified: { label: "Verified", color: "#14b8a6", limit: 15 },
  trusted:  { label: "Trusted",  color: "#10b981", limit: 25 },
  senior:   { label: "Senior",   color: "#6366f1", limit: 50 },
};

const STATUS_READABLE = {
  PENDING_MODERATOR:     { label: "Pending Moderation", color: "#f59e0b" },
  APPROVED_BY_MODERATOR: { label: "Approved by Moderator", color: "#10b981" },
  REJECTED_BY_MODERATOR: { label: "Rejected", color: "#ef4444" },
  ESCALATED:             { label: "Escalated", color: "#6366f1" },
  APPROVED_BY_SENIOR:    { label: "Senior Approved", color: "#10b981" },
  COMMUNITY_VERIFIED:    { label: "Community Verified", color: "#10b981" },
  NGO_DISPATCHED:        { label: "NGO Dispatched", color: "#14b8a6" },
};

const APPROVE_REASONS = [
  "Genuine disaster report",
  "Relevant media attached",
  "Location verified",
  "Sufficient information provided",
  "Consistent with surrounding reports",
  "Credible eyewitness account",
];
const REJECT_REASONS = [
  "Spam",
  "Gibberish / insufficient information",
  "Irrelevant",
  "Duplicate",
  "Misleading information",
  "Insufficient evidence",
  "Abusive content",
  "Suspicious media",
];
const ESCALATE_REASONS = [
  "Potentially serious incident requiring senior review",
  "Conflicting evidence",
  "Possible misinformation",
  "Location inconsistency",
  "High-impact incident with insufficient verification",
  "AI and human assessment disagree",
  "Requires senior moderator review",
];

function ScoreBar({ label, value, max = 100, color = "#14b8a6", invert = false }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const displayColor = invert ? (value > 60 ? "#ef4444" : value > 30 ? "#f59e0b" : "#10b981") : color;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontWeight: 700, color: displayColor }}>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 5, background: "var(--border)", borderRadius: "var(--radius-full)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: displayColor, borderRadius: "var(--radius-full)", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function TrustScoreGauge({ score }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 36;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={36} fill="none" stroke="var(--border)" strokeWidth={8} />
        <circle
          cx={50} cy={50} r={36} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x={50} y={54} textAnchor="middle" fill={color} fontSize={18} fontWeight={700} fontFamily="Inter">{score}</text>
      </svg>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Trust Score</span>
    </div>
  );
}

function DecisionModal({ task, onConfirm, onClose }) {
  const [action, setAction] = useState("approve");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const reasonOptions = action === "approve" ? APPROVE_REASONS : action === "reject" ? REJECT_REASONS : ESCALATE_REASONS;
  const actionColors = { approve: "#10b981", reject: "#ef4444", escalate: "#f59e0b" };

  async function submit() {
    if (!reason) { setErr("Please select a reason."); return; }
    setBusy(true); setErr(null);
    try {
      await onConfirm(task.task_id, action, reason, notes);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        padding: "24px 28px", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Submit Decision — #{task.id?.slice(0, 8)}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20 }}>✕</button>
        </div>

        <div style={{ background: "var(--bg-card-alt)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 20, fontSize: "0.88rem" }}>
          <strong>{task.title}</strong>
        </div>

        {/* Action selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { id: "approve", label: "Approve", color: "#10b981", bg: "rgba(16,185,129,0.10)" },
            { id: "reject",  label: "Reject",  color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
            { id: "escalate",label: "Escalate",color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => { setAction(a.id); setReason(""); }}
              style={{
                padding: "10px 8px",
                borderRadius: "var(--radius-sm)",
                border: action === a.id ? `2px solid ${a.color}` : "1px solid var(--border)",
                background: action === a.id ? a.bg : "transparent",
                color: action === a.id ? a.color : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: action === a.id ? 700 : 500,
                fontSize: "0.88rem",
                transition: "all 0.12s ease",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Reason */}
        <div className="field">
          <label>Reason for {action} *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {reasonOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Optional notes */}
        <div className="field">
          <label>Additional notes (optional)</label>
          <textarea rows={3} placeholder="Add any context for your decision…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {err && <div className="error-banner">{err}</div>}

        <div style={{ background: "var(--primary-bg)", border: "1px solid var(--primary-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", marginBottom: 20, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          AI provides recommendations. Final verification is performed by a human moderator.
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn"
            disabled={!reason || busy}
            onClick={submit}
            style={{ background: actionColors[action], color: "#fff", border: "none" }}
          >
            {busy ? "Submitting…" : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ task, onDecision }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = task.analysis || {};
  const modStatus = STATUS_READABLE[task.moderation_status] || { label: task.moderation_status, color: "var(--text-muted)" };
  const severityColor = { critical: "#ef4444", high: "#f59e0b", moderate: "#14b8a6", low: "#10b981" };

  return (
    <div className="queue-card" style={{ marginBottom: 16 }}>
      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="category-tag">{task.category}</span>
            <span style={{ background: `${severityColor[task.severity] || "#6b7280"}20`, color: severityColor[task.severity] || "#6b7280", padding: "1px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>
              {task.severity}
            </span>
            <span style={{ background: `${modStatus.color}15`, color: modStatus.color, padding: "1px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 600 }}>
              {modStatus.label}
            </span>
          </div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>{task.title}</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            By <strong>{task.author?.name || "Citizen"}</strong> · {new Date(task.created_at).toLocaleString()}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Collapse ↑" : "Review →"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Description */}
          <p style={{ margin: 0, color: "var(--text-body)", fontSize: "0.9rem", lineHeight: 1.7 }}>
            {task.description || <em>No description provided.</em>}
          </p>

          {/* Location */}
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            📍 Lat: {task.lat?.toFixed(4)}, Lng: {task.lng?.toFixed(4)}
            {task.exif_status === "verified" && (
              <span style={{ marginLeft: 10, background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 600 }}>GPS Verified</span>
            )}
          </div>

          {/* Media */}
          {task.media && task.media.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {task.media.map((m) => (
                <a key={m.id} href={m.file_path} target="_blank" rel="noreferrer">
                  <img src={m.file_path} alt="Incident" style={{ width: 100, height: 75, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
                </a>
              ))}
            </div>
          )}

          {/* AI Moderation Assist Panel */}
          <div className="assessment-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="assessment-title" style={{ margin: 0 }}>AI MODERATION ASSIST</div>
              <span style={{ fontSize: "0.75rem", background: "var(--primary-bg)", color: "var(--primary)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontWeight: 600 }}>HEURISTIC ANALYSIS</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
              <ScoreBar label="Relevance" value={analysis.relevanceScore || 0} color="#10b981" />
              <ScoreBar label="Spam Probability" value={analysis.spamScore || 0} color="#f59e0b" invert />
              <ScoreBar label="Gibberish" value={analysis.gibberishScore || 0} color="#ef4444" invert />
              <ScoreBar label="Duplicate Probability" value={analysis.duplicateProbability || 0} color="#6366f1" invert />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, marginBottom: 12 }}>
              <div style={{ fontSize: "0.82rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Location Confidence: </span>
                <strong style={{ color: analysis.locationConfidence === "High" ? "#10b981" : "#f59e0b" }}>
                  {analysis.locationConfidence || "Unknown"}
                </strong>
              </div>
              <div style={{ fontSize: "0.82rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Overall Confidence: </span>
                <strong style={{ color: (analysis.overallConfidence || 0) > 65 ? "#10b981" : "#f59e0b" }}>
                  {analysis.overallConfidence || 0}%
                </strong>
              </div>
            </div>

            {analysis.flags && analysis.flags.length > 0 && (
              <>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Why was this flagged?</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.82rem", color: "var(--text-body)", lineHeight: 1.7 }}>
                  {analysis.flags.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </>
            )}

            {analysis.detectedKeywords && analysis.detectedKeywords.length > 0 && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Detected keywords: {analysis.detectedKeywords.slice(0, 6).join(", ")}
              </div>
            )}

            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--primary-bg)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
              AI provides recommendations. Final verification is performed by a human moderator.
            </div>
          </div>

          {/* Decision buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onDecision(task)}
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
            >
              Submit Decision
            </button>
            <Link to={`/report/${task.id}`} className="btn btn-outline btn-sm" target="_blank">
              View Full Report ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModeratorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("queue");
  const [tasks, setTasks] = useState([]);
  const [completedDecisions, setCompletedDecisions] = useState([]);
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [escalatedQueue, setEscalatedQueue] = useState([]);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const [selectedTask, setSelectedTask] = useState(null); // for decision modal
  const [escalateForm, setEscalateForm] = useState({ reportId: "", action: "approve", reason: "" });
  const [escalateBusy, setEscalateBusy] = useState(false);

  const isModerator = user && ["student_moderator", "senior_moderator", "admin"].includes(user.role);
  const isSenior = user && ["senior_moderator", "admin"].includes(user.role);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getModeratorTasks("pending");
      setTasks(data.tasks || []);
      setProfile(data.profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await api.getModeratorStats();
      setStats(data.stats);
      setProfile(data.profile);
      setCompletedDecisions(data.recentDecisions || []);
    } catch (e) {
      console.error("Stats error", e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadEscalated = useCallback(async () => {
    if (!isSenior) return;
    try {
      const data = await api.getEscalated();
      setEscalatedQueue(data.escalated || []);
    } catch (e) {
      console.error("Escalated load error", e);
    }
  }, [isSenior]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }

    // Check if non-moderator: show application gate
    if (!isModerator) {
      api.getApplicationStatus()
        .then((data) => setApplicationStatus(data))
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    loadTasks();
    loadStats();
    loadEscalated();
  }, [user, isModerator]);

  async function handleDecisionConfirm(taskId, action, reason, notes) {
    let result;
    if (action === "approve") result = await api.approveTask(taskId, reason, notes);
    else if (action === "reject") result = await api.rejectTask(taskId, reason, notes);
    else result = await api.escalateTask(taskId, reason, notes);

    setFeedback(result.message);
    setTimeout(() => setFeedback(null), 4000);
    setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    loadStats();
  }

  async function handleEscalatedResolve(e) {
    e.preventDefault();
    if (!escalateForm.reason) return;
    setEscalateBusy(true);
    try {
      const data = await api.resolveEscalated(escalateForm.reportId, escalateForm.action, escalateForm.reason);
      setFeedback(data.message);
      setTimeout(() => setFeedback(null), 4000);
      setEscalatedQueue((prev) => prev.filter((r) => r.id !== escalateForm.reportId));
      setEscalateForm({ reportId: "", action: "approve", reason: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setEscalateBusy(false);
    }
  }

  const level = profile?.level || "trainee";
  const levelCfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.trainee;

  // ── GATE: Not logged in ──
  if (!user) return null;

  // ── GATE: Not a moderator ──
  if (!isModerator) {
    const app = applicationStatus?.application;
    const trainingDone = applicationStatus?.profile?.training_completed;

    if (!app) {
      // No application at all
      return (
        <div className="mod-dashboard" style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
            <h1 style={{ marginBottom: 8 }}>Student Moderator Program</h1>
            <p style={{ color: "var(--text-muted)", maxWidth: 420, margin: "0 auto 28px" }}>
              DisasterConnect relies on trained students to verify disaster reports before they reach NGOs. Apply to join the student workforce and earn micro-payments for legitimate moderation work.
            </p>
            <Link to="/moderator/apply" className="btn btn-primary" style={{ padding: "12px 28px", fontSize: "1rem" }}>
              Apply to Become a Moderator
            </Link>
            <div style={{ marginTop: 20 }}>
              <Link to="/" style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>Return to Feed</Link>
            </div>
          </div>
        </div>
      );
    }

    if (app.status === "pending" || app.status === "under_review") {
      return (
        <div className="mod-dashboard" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h1>Application Under Review</h1>
            <p style={{ color: "var(--text-muted)" }}>
              Your application was submitted on {new Date(app.created_at).toLocaleDateString()}. Our team will review it within 2–3 business days.
            </p>
            <Link to="/moderator/apply" className="btn btn-outline" style={{ marginTop: 16 }}>View Application Details</Link>
          </div>
        </div>
      );
    }

    if (app.status === "approved" && !trainingDone) {
      return (
        <div className="mod-dashboard" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <h1>Training Required</h1>
            <p style={{ color: "var(--text-muted)" }}>
              Your application has been approved. Before you can access the moderation queue, please complete the mandatory training module (minimum score: 80%).
            </p>
            <Link to="/moderator/training" className="btn btn-primary" style={{ marginTop: 16, padding: "12px 28px" }}>
              Start Training
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="mod-dashboard" style={{ maxWidth: 500, margin: "0 auto", textAlign: "center", padding: "48px 24px" }}>
        <h1>Access Restricted</h1>
        <p style={{ color: "var(--text-muted)" }}>Your moderator access is currently unavailable. Status: <strong>{app?.status}</strong></p>
        <Link to="/" className="btn btn-outline" style={{ marginTop: 16 }}>Return to Feed</Link>
      </div>
    );
  }

  const tabs = [
    { id: "queue", label: `Queue (${tasks.length})` },
    { id: "analytics", label: "Analytics" },
    { id: "history", label: "History" },
    ...(isSenior ? [{ id: "escalated", label: `Escalated (${escalatedQueue.length})` }] : []),
  ];

  return (
    <div className="mod-dashboard">
      {selectedTask && (
        <DecisionModal
          task={selectedTask}
          onConfirm={handleDecisionConfirm}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Header */}
      <div className="mod-header">
        <div className="mod-header-top">
          <div className="mod-title">
            <h1>Moderation Queue</h1>
            <div className="mod-subtitle">
              Verify submitted disaster incidents for genuine calamity relevance and ground truth.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background: `${levelCfg.color}20`, color: levelCfg.color, padding: "3px 10px", borderRadius: "var(--radius-full)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" }}>
              {levelCfg.label}
            </span>
            <span className="mod-badge-role">{user.name}</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: "0.9rem", fontWeight: 600 }}>
          {feedback}
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      {/* Quick stat strip */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Trust Score", value: `${stats.trustScore || 50}/100`, color: stats.trustScore >= 80 ? "#10b981" : "#f59e0b" },
            { label: "Accuracy", value: `${(stats.accuracy || 100).toFixed(1)}%`, color: "#14b8a6" },
            { label: "Total Reviews", value: stats.totalReviews, color: "var(--text-primary)" },
            { label: "Pending Tasks", value: stats.pendingTasks, color: "var(--amber)" },
            { label: "Wallet", value: `₹${(stats.walletBalance || 0).toFixed(0)}`, color: "#10b981" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mod-tabs" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`mod-tab-btn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(t.id);
              if (t.id === "queue") loadTasks();
              if (t.id === "analytics") loadStats();
              if (t.id === "escalated") loadEscalated();
            }}
          >
            {t.label}
          </button>
        ))}
        <Link to="/moderator/wallet" className="mod-tab-btn" style={{ textDecoration: "none" }}>
          Wallet →
        </Link>
      </div>

      {/* QUEUE TAB */}
      {activeTab === "queue" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Assigned to You ({tasks.length})</h2>
            <button className="btn btn-outline btn-sm" onClick={loadTasks}>Refresh</button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}><div className="spinner" /></div>
          ) : tasks.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <h3 style={{ margin: "0 0 6px 0" }}>All caught up!</h3>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>No pending reports assigned to you. Check back later.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <ReportCard key={task.task_id} task={task} onDecision={setSelectedTask} />
            ))
          )}
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: 48 }}><div className="spinner" /></div>
          ) : stats ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 24, alignItems: "center" }}>
                <TrustScoreGauge score={stats.trustScore || 50} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                  {[
                    ["Accuracy", `${(stats.accuracy || 100).toFixed(1)}%`],
                    ["Level", levelCfg.label],
                    ["Approvals", stats.approvals || 0],
                    ["Rejections", stats.rejections || 0],
                    ["Escalations", stats.escalations || 0],
                    ["Audited Decisions", stats.auditedCount || 0],
                    ["Correct", stats.auditCorrect || 0],
                    ["Incorrect", stats.auditIncorrect || 0],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Earnings summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Earned Today", value: `₹${(stats.todayEarnings || 0).toFixed(0)}`, color: "#10b981" },
                  { label: "This Week", value: `₹${(stats.weekEarnings || 0).toFixed(0)}`, color: "#14b8a6" },
                  { label: "Total Balance", value: `₹${(stats.walletBalance || 0).toFixed(0)}`, color: "#10b981" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px 20px" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: "1.4rem", color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Activity chart */}
              {stats.activityByDay && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
                  <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Activity — Last 7 Days</h3>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
                    {Object.entries(stats.activityByDay).map(([day, count]) => {
                      const max = Math.max(...Object.values(stats.activityByDay), 1);
                      const h = Math.max(4, (count / max) * 70);
                      return (
                        <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{ width: "100%", height: h, background: "var(--primary)", borderRadius: "var(--radius-xs) var(--radius-xs) 0 0", minHeight: 4 }} />
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{day}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 700 }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Audit notice */}
              {stats.auditedCount > 0 && (
                <div style={{ background: "var(--primary-bg)", border: "1px solid var(--primary-border)", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: "0.88rem", color: "var(--text-body)" }}>
                  <strong>{stats.auditedCount}</strong> of your recent decisions have been audited by a senior moderator.
                  {stats.auditCorrect > 0 && <> <span style={{ color: "#10b981" }}>{stats.auditCorrect} correct</span></>}
                  {stats.auditIncorrect > 0 && <>, <span style={{ color: "#ef4444" }}>{stats.auditIncorrect} incorrect</span></>}.
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No analytics available yet.</p>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Recent Decisions</h2>
          {completedDecisions.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No decisions made yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Action</th>
                    <th>Reason</th>
                    <th>Earned</th>
                    <th>Audit</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {completedDecisions.map((d) => {
                    const actionColor = d.action === "approve" ? "#10b981" : d.action === "reject" ? "#ef4444" : "#f59e0b";
                    const auditColor = d.audit_status === "correct" ? "#10b981" : d.audit_status === "incorrect" ? "#ef4444" : "var(--text-muted)";
                    return (
                      <tr key={d.id}>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.report_title}</td>
                        <td><span style={{ fontWeight: 700, color: actionColor, textTransform: "capitalize" }}>{d.action}</span></td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{d.reason}</td>
                        <td style={{ color: "#10b981", fontWeight: 700 }}>+₹{d.reward_amount}</td>
                        <td style={{ fontWeight: 600, color: auditColor, fontSize: "0.82rem", textTransform: "capitalize" }}>{d.audit_status}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{new Date(d.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ESCALATED TAB (Senior only) */}
      {activeTab === "escalated" && isSenior && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1rem" }}>Escalated Reports — Awaiting Senior Review ({escalatedQueue.length})</h2>
          {escalatedQueue.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
              No escalated reports pending.
            </div>
          ) : (
            escalatedQueue.map((report) => (
              <div key={report.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span className="category-tag">{report.category}</span>
                  <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1", padding: "1px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 600 }}>ESCALATED</span>
                </div>
                <h3 style={{ margin: "0 0 4px 0" }}>{report.title}</h3>
                <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Escalation reason: <strong style={{ color: "var(--text-body)" }}>{report.escalated_reason || report.moderation_reason}</strong>
                </p>
                <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "var(--text-body)", lineHeight: 1.6 }}>{report.description}</p>

                {escalateForm.reportId === report.id ? (
                  <form onSubmit={handleEscalatedResolve} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <select value={escalateForm.action} onChange={(e) => setEscalateForm((p) => ({ ...p, action: e.target.value }))}
                        style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", background: "var(--bg-input)", color: "var(--text-primary)" }}>
                        <option value="approve">Approve</option>
                        <option value="reject">Reject</option>
                      </select>
                      <select value={escalateForm.reason} onChange={(e) => setEscalateForm((p) => ({ ...p, reason: e.target.value }))}
                        style={{ flex: 1, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", background: "var(--bg-input)", color: "var(--text-primary)" }}>
                        <option value="">Select reason…</option>
                        {(escalateForm.action === "approve" ? APPROVE_REASONS : REJECT_REASONS).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!escalateForm.reason || escalateBusy}>
                        {escalateBusy ? "…" : "Confirm Decision"}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEscalateForm({ reportId: "", action: "approve", reason: "" })}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn btn-outline btn-sm" onClick={() => setEscalateForm({ reportId: report.id, action: "approve", reason: "" })}>
                    Review & Decide
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
