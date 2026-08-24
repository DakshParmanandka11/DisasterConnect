import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { socket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { useGeolocation } from "../hooks/useGeolocation";
import SignalMeter from "../components/SignalMeter";
import MapPicker from "../components/MapPicker";

const STATUS_LABEL = {
  pending: "Pending Quorum",
  flagged: "Verified / High-Priority",
  under_review: "Under NGO Review",
  resolved: "Resolved",
};

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [config, setConfig] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const { user } = useAuth();
  const geo = useGeolocation();

  const load = useCallback(() => {
    api.getReport(id).then((data) => setReport(data.report));
  }, [id]);

  useEffect(() => {
    load();
    api.config().then(setConfig).catch(() => {});
  }, [load]);

  useEffect(() => {
    function onUpdate(updated) {
      if (updated.id !== id) return;
      setReport(updated);
    }
    function onFlagged(updated) {
      if (updated.id !== id) return;
      setReport(updated);
      setNotice("🚨 This report crossed the 40% verification threshold and has been auto-flagged! Nearby NGOs have been notified.");
    }
    socket.on("report:updated", onUpdate);
    socket.on("report:flagged", onFlagged);
    return () => {
      socket.off("report:updated", onUpdate);
      socket.off("report:flagged", onFlagged);
    };
  }, [id]);

  async function castVote(voteType) {
    setVoteError(null);
    setVoteBusy(true);
    try {
      let coords = geo.coords;
      if (!coords) coords = await geo.request();
      const data = await api.vote(id, { vote_type: voteType, lat: coords.lat, lng: coords.lng });
      setReport(data.report);
      if (data.flaggedNow) {
        setNotice("🚨 This report crossed the 40% verification threshold and has been auto-flagged! Nearby NGOs have been notified.");
      }
    } catch (err) {
      setVoteError(err.message);
    } finally {
      setVoteBusy(false);
    }
  }

  async function runSimulation() {
    setSimBusy(true);
    setVoteError(null);
    try {
      const data = await api.simulateVotes(id);
      setReport(data.report);
      if (data.flaggedNow) {
        setNotice("⚡ Simulated local votes pushed this report past 40% — it is now flagged, and nearby NGOs were notified.");
      }
    } catch (err) {
      setVoteError(err.message);
    } finally {
      setSimBusy(false);
    }
  }

  async function updateStatus(status) {
    const data = await api.setStatus(id, status);
    setReport(data.report);
  }

  if (!report) {
    return <div className="container" style={{ paddingTop: 40, color: "var(--text-muted)" }}>Loading verification thread…</div>;
  }

  const canVote = user && user.role === "citizen" && report.status === "pending";

  return (
    <div className="container" style={{ maxWidth: 840, paddingTop: 20, paddingBottom: 60 }}>
      <Link to="/" style={{ fontSize: 13, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
        ← Back to feed
      </Link>

      <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "flex" }}>
          {/* Left Voting Column */}
          <div className="rp-vote" style={{ padding: "16px 10px", width: 52, minWidth: 52 }}>
            <button
              className="rp-vote__btn rp-vote__btn--up"
              disabled={!canVote || voteBusy}
              onClick={() => castVote("up")}
              title="Confirm — I'm within 10 km and can verify"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1L11.196 10H0.804L6 1Z"/>
              </svg>
            </button>
            <span className="rp-vote__score" style={{ fontSize: 13, margin: "6px 0", textAlign: "center" }}>
              {report.upvotes}
            </span>
            <button
              className="rp-vote__btn rp-vote__btn--down"
              disabled={!canVote || voteBusy}
              onClick={() => castVote("down")}
              title="Doubtful — I'm within 10 km and dispute this"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 11L0.804 2H11.196L6 11Z"/>
              </svg>
            </button>
          </div>

          {/* Main Detail Content */}
          <div className="reddit-post-card__main" style={{ padding: 20 }}>
            <div className="reddit-post-card__meta">
              <span className="reddit-post-card__channel">c/{report.category.replace("_", "")}</span>
              <span>•</span>
              <span className="reddit-post-card__author">Reported by {report.author?.name || "citizen"}</span>
              <span>•</span>
              <span>{new Date(report.created_at + "Z").toLocaleString()}</span>
              <span className={`status-badge status-${report.status}`}>
                {STATUS_LABEL[report.status]}
              </span>
            </div>

            <h1 style={{ fontSize: 22, marginTop: 8, marginBottom: 8 }}>{report.title}</h1>

            {/* EXIF Authenticity Badge */}
            {report.exif_status === "verified" && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid #10B981", padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                🟢 EXIF Hardware Verified (Fresh Photo & Camera GPS Match)
              </div>
            )}
            {report.exif_status === "suspicious" && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "1px solid #EF4444", padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                🔴 EXIF Warning: Photo Timestamp Stale (&gt;48h) or GPS Mismatch
              </div>
            )}
            {report.exif_status === "missing" && (
              <div style={{ background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "1px solid #F59E0B", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                🟡 EXIF Geotag Missing (Web Screenshot / App Image)
              </div>
            )}

            <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              <span>Severity: <strong style={{ color: "var(--alert)", textTransform: "capitalize" }}>{report.severity}</strong></span>
              <span>•</span>
              <span className="mono" style={{ color: "var(--intel)" }}>
                📍 Geotag: {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
              </span>
              {report.remote_votes > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: "#38bdf8" }}>📡 Remote Signals: {report.remote_votes}</span>
                </>
              )}
            </div>

            {/* Spatial Density Cluster Alert */}
            {report.spatial_density_score >= 3 && (
              <div style={{ background: "rgba(220, 38, 38, 0.2)", color: "#FCA5A5", border: "1px solid #DC2626", padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
                🚨 SPATIAL CLUSTER AUTO-VERIFIED: {report.spatial_density_score}+ unique reports submitted in 2km radius within 30 min. Auto-escalated to NGOs during local evacuation.
              </div>
            )}

            {/* Duplicate Cluster Warning Banner */}
            {report.confirmations > 1 && (
              <div
                style={{
                  padding: 14,
                  marginBottom: 16,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  backgroundColor: "rgba(56, 189, 248, 0.12)",
                  fontSize: 13,
                  color: "var(--intel)",
                }}
              >
                <strong>🔗 Incident Cluster ({report.confirmations} reports):</strong> Multiple separate community reports describe this same incident nearby within recent hours.
                {report.clusterSiblings.length > 0 && (
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                    {report.clusterSiblings.map((s) => (
                      <li key={s.id}>
                        <Link to={`/report/${s.id}`} style={{ textDecoration: "underline" }}>{s.title}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {notice && (
              <div
                style={{
                  padding: 14,
                  marginBottom: 16,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#FCA5A5",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {notice}
              </div>
            )}

            {report.description && (
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)", margin: "0 0 16px 0" }}>
                {report.description}
              </p>
            )}

            {/* Media Uploads Lightbox Preview */}
            {report.media?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, margin: "16px 0" }}>
                {report.media.map((m) =>
                  m.file_type === "video" ? (
                    <video key={m.id} src={m.file_path} controls style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
                  ) : (
                    <img key={m.id} src={m.file_path} alt="" style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", objectFit: "cover", aspectRatio: "16/9" }} />
                  )
                )}
              </div>
            )}

            {/* Verification Gauge Box */}
            <div style={{ padding: 16, borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-input)", border: "1px solid var(--border)", margin: "16px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>Community Verification Gauge</span>
                <span className="mono" style={{ color: "var(--alert)" }}>
                  {report.upvotePct.toFixed(1)}% Upvoted
                </span>
              </div>
              
              <SignalMeter
                pct={report.upvotePct}
                totalVotes={report.totalVotes}
                threshold={config?.verification_threshold_pct ?? 40}
                quorum={config?.min_vote_quorum ?? 10}
              />
              
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, marginBottom: 0 }}>
                {report.upvotes} upvotes · {report.downvotes} downvotes. Strictly limited to users within{" "}
                <strong>{config?.voting_radius_km ?? 10} km</strong> of incident location.
              </p>

              {voteError && <div className="error-banner" style={{ marginTop: 12 }}>{voteError}</div>}

              {canVote ? (
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <button className="btn btn-signal btn-sm" disabled={voteBusy} onClick={() => castVote("up")}>
                    ▲ Confirm Incident (Upvote)
                  </button>
                  <button className="btn btn-outline btn-sm" disabled={voteBusy} onClick={() => castVote("down")}>
                    ▼ Dispute / Doubtful (Downvote)
                  </button>
                </div>
              ) : !user ? (
                <p style={{ fontSize: 13, marginTop: 12, color: "var(--text-muted)" }}>
                  <Link to="/login" style={{ color: "var(--intel)", fontWeight: 600 }}>Log in</Link> as a citizen within 10 km to cast your verification vote.
                </p>
              ) : report.status !== "pending" ? (
                <p style={{ fontSize: 13, marginTop: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Voting is locked — this report has already crossed the threshold ({report.status.replace("_", " ")}).
                </p>
              ) : null}

              {user && report.status === "pending" && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                  <button className="btn btn-outline btn-sm" disabled={simBusy} onClick={runSimulation} style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>
                    {simBusy ? "Simulating…" : "⚡ Demo: Simulate Local Votes"}
                  </button>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                    Instantly casts synthetic nearby votes to trigger auto-flagging and NGO alert.
                  </span>
                </div>
              )}
            </div>

            {/* Map Location Card */}
            <div className="field" style={{ marginTop: 20 }}>
              <label>Geotagged Incident Location</label>
              <MapPicker lat={report.lat} lng={report.lng} editable={false} radiusKm={config?.voting_radius_km} />
            </div>

            {/* NGO Action Box */}
            {user && (user.role === "ngo" || user.role === "admin") && report.status !== "pending" && (
              <div style={{ padding: 16, borderRadius: "var(--radius-sm)", backgroundColor: "var(--intel-muted)", border: "1px solid rgba(0, 121, 211, 0.3)", marginTop: 20 }}>
                <h4 style={{ margin: "0 0 10px 0", color: "var(--intel)" }}>🏥 NGO Relief Dispatch Controls</h4>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-blue btn-sm" onClick={() => updateStatus("under_review")}>
                    Mark Under Review
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => updateStatus("resolved")}>
                    Mark Resolved
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
