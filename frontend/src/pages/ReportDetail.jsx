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
  const [fundraiserData, setFundraiserData] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const { user } = useAuth();
  const geo = useGeolocation();

  const load = useCallback(() => {
    api.getReport(id).then((data) => setReport(data.report));
    api.getReportFundraiser(id).then(setFundraiserData).catch(() => {});
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
      setNotice("This report crossed the 40% verification threshold and has been auto-flagged. Nearby NGOs have been notified.");
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
        setNotice("This report crossed the 40% verification threshold and has been auto-flagged. Nearby NGOs have been notified.");
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
        setNotice("Simulated local votes pushed this report past 40% — it is now flagged, and nearby NGOs were notified.");
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
              <div className="exif-badge exif-badge--ok">
                EXIF verified — fresh photo, camera GPS match
              </div>
            )}
            {report.exif_status === "suspicious" && (
              <div className="exif-badge exif-badge--warn">
                EXIF warning — photo timestamp stale (&gt;48h) or GPS mismatch
              </div>
            )}
            {report.exif_status === "missing" && (
              <div className="exif-badge exif-badge--missing">
                EXIF geotag missing — web screenshot or app image
              </div>
            )}

            <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              <span>Severity: <strong style={{ color: "var(--alert)", textTransform: "capitalize" }}>{report.severity}</strong></span>
              <span>·</span>
              <span className="mono" style={{ color: "var(--primary)" }}>Geotagged location verified</span>
              {report.remote_votes > 0 && (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--primary)" }}>Remote signals: {report.remote_votes}</span>
                </>
              )}
            </div>

            {/* Spatial cluster auto-verified alert */}
            {report.spatial_density_score >= 3 && (
              <div style={{ background: "rgba(220, 38, 38, 0.10)", color: "var(--red)", border: "1px solid rgba(220, 38, 38, 0.25)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                Spatial cluster auto-verified: {report.spatial_density_score}+ unique reports within 2 km / 30 min. Escalated to NGOs.
              </div>
            )}

            {/* Incident cluster notice */}
            {report.confirmations > 1 && (
              <div style={{ padding: "10px 14px", marginBottom: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--primary-border)", backgroundColor: "var(--primary-bg)", fontSize: 13, color: "var(--primary)" }}>
                <strong>Location cluster ({report.confirmations} reports):</strong> Multiple separate community reports describe this same incident within recent hours.
                {report.clusterSiblings.length > 0 && (
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                    {report.clusterSiblings.map((s) => (
                      <li key={s.id}><Link to={`/report/${s.id}`} style={{ textDecoration: "underline" }}>{s.title}</Link></li>
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
              ) : report.status !== "pending" ? (
                <p style={{ fontSize: 13, marginTop: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Voting is locked — this report has already crossed the threshold ({report.status.replace("_", " ")}).
                </p>
              ) : null}

              {user && report.status === "pending" && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                  <button className="btn btn-outline btn-sm" disabled={simBusy} onClick={runSimulation} style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>
                    {simBusy ? "Simulating…" : "Demo: Simulate Local Votes"}
                  </button>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                    Casts synthetic nearby votes to trigger auto-flagging and NGO alert.
                  </span>
                </div>
              )}
            </div>

            {/* ─── GROUND RELIEF FUNDRAISER (UPI QR CODE) ─── */}
            {fundraiserData && fundraiserData.fundraisers?.length > 0 && (
              <div style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 18, marginTop: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--green)", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span>Ground Relief Fundraiser</span>
                  <span style={{ fontSize: 11, background: "var(--green-bg)", color: "var(--green)", padding: "1px 8px", borderRadius: 3, fontWeight: 600 }}>Direct Transfer</span>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px 0", lineHeight: 1.4 }}>
                  Scan the verified UPI QR code below with any mobile app (GPay, PhonePe, Paytm, BHIM) to send immediate emergency relief funds directly to ground responders.
                </p>

                {fundraiserData.fundraisers.map((f) => (
                  <div key={f.ngoId} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginTop: 10 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center", background: "#ffffff", padding: 10, borderRadius: 8 }}>
                        <img src={f.qrUrl} alt="UPI QR Code" style={{ width: 130, height: 130, display: "block" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#1e293b", marginTop: 4, display: "block" }}>Scan with GPay/PhonePe</span>
                      </div>

                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{f.orgName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 8px 0" }}>
                          Verified partner — responding within {f.distanceKm} km zone
                        </div>
                        <div style={{ fontSize: 12, color: "var(--intel)", marginBottom: 8, fontWeight: 600 }}>
                          Focus: {f.focusAreas}
                        </div>

                        <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <code style={{ fontSize: 13, color: "var(--verified)", fontWeight: 700 }}>{f.upiId}</code>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: "2px 8px" }}
                            onClick={() => { navigator.clipboard?.writeText(f.upiId); alert("UPI ID copied!"); }}
                          >
                            Copy UPI
                          </button>
                        </div>

                        {/* Donation progress bar */}
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                          <span>Relief Goal Raised: <strong style={{ color: "var(--verified)" }}>₹{f.raisedAmount.toLocaleString()}</strong></span>
                          <span>Target: ₹{f.targetGoal.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (f.raisedAmount / f.targetGoal) * 100)}%`, height: "100%", background: "var(--verified)" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Map Location Card */}
            <div className="field" style={{ marginTop: 20 }}>
              <label>Geotagged Incident Location</label>
              <MapPicker lat={report.lat} lng={report.lng} editable={false} radiusKm={config?.voting_radius_km} />
            </div>

            {/* NGO Action Box */}
            {user && (user.role === "ngo" || user.role === "admin") && report.status !== "pending" && (
              <div style={{ padding: 16, borderRadius: "var(--radius-sm)", backgroundColor: "var(--intel-muted)", border: "1px solid rgba(0, 121, 211, 0.3)", marginTop: 20 }}>
              <h4 style={{ margin: "0 0 10px 0", color: "var(--primary)", fontWeight: 600 }}>NGO Relief Dispatch Controls</h4>
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
