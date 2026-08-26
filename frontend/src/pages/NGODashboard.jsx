import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { socket } from "../api/socket";
import SignalMeter from "../components/SignalMeter";

const STATUS_LABEL = {
  pending: "Pending Verification",
  flagged: "Verified / High-Priority",
  under_review: "Under NGO Review",
  resolved: "Resolved",
};

export default function NGODashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    api.ngoNotifications().then(setData).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  useEffect(() => {
    socket.on("report:flagged", load);
    socket.on("report:updated", load);
    return () => {
      socket.off("report:flagged", load);
      socket.off("report:updated", load);
    };
  }, []);

  async function ack(notifId) {
    await api.ackNotification(notifId);
    load();
  }

  async function setStatus(reportId, status) {
    await api.setStatus(reportId, status);
    load();
  }

  if (error) return <div className="container" style={{ paddingTop: 40 }}><div className="error-banner">{error}</div></div>;
  if (!data) return <div className="container" style={{ paddingTop: 40, color: "var(--text-muted)", fontSize: 13 }}>Loading NGO dashboard…</div>;

  return (
    <div className="container" style={{ maxWidth: 840, paddingTop: 24, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 0" }}>
          NGO Dashboard
        </p>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 4px 0" }}>
          {data.ngo?.org_name || "Relief Command Centre"}
        </h1>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
          Flagged incidents within{" "}
          <strong style={{ color: "var(--primary)" }}>{data.ngo?.service_radius_km || 25} km</strong> of your service zone
        </p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          padding: "10px 16px",
          backgroundColor: "var(--bg-card-alt)",
          borderBottom: "1px solid var(--border)",
          fontWeight: 600,
          fontSize: 12,
          color: "var(--text-muted)",
          display: "flex",
          justifyContent: "space-between",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          <span>Incoming high-priority incidents ({data.notifications?.length || 0})</span>
          <span style={{ color: "var(--green)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            Live alerts active
          </span>
        </div>

        {(!data.notifications || data.notifications.length === 0) ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No high-priority incidents currently flagged in your service radius.
          </div>
        ) : (
          data.notifications.map((r) => (
            <div
              key={r.notification_id}
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                backgroundColor: r.notification_status === "sent" ? "rgba(245,158,11,0.05)" : "var(--bg-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="tag">{r.category.replace("_", " ")}</span>
                    <span className={`status-badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    {r.notification_status === "sent" && (
                      <span className="tag" style={{ backgroundColor: "var(--red-bg)", color: "var(--red)" }}>New</span>
                    )}
                  </div>
                  <Link to={`/report/${r.id}`} style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                    {r.title}
                  </Link>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Geotagged · Notified {new Date(r.notified_at + "Z").toLocaleTimeString()}
                  </div>
                </div>
                <div style={{ width: 160, flexShrink: 0 }}>
                  <SignalMeter pct={r.upvotePct} totalVotes={r.totalVotes} size="sm" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {r.notification_status === "sent" && (
                  <button className="btn btn-outline btn-sm" onClick={() => ack(r.notification_id)}>
                    Acknowledge
                  </button>
                )}
                {r.status === "flagged" && (
                  <button className="btn btn-primary btn-sm" onClick={() => setStatus(r.id, "under_review")}>
                    Mark under review
                  </button>
                )}
                {r.status === "under_review" && (
                  <button className="btn btn-primary btn-sm" onClick={() => setStatus(r.id, "resolved")}>
                    Mark resolved
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
