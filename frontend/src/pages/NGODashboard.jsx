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
    function refresh() {
      load();
    }
    socket.on("report:flagged", refresh);
    socket.on("report:updated", refresh);
    return () => {
      socket.off("report:flagged", refresh);
      socket.off("report:updated", refresh);
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
  if (!data) return <div className="container" style={{ paddingTop: 40, color: "var(--text-muted)" }}>Loading NGO dispatch command center…</div>;

  return (
    <div className="container" style={{ maxWidth: 840, paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "var(--intel)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
          🏥
        </div>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{data.ngo.org_name}</h1>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
            Relief Command Center • Flagged incidents within <span className="mono" style={{ color: "var(--intel)", fontWeight: 700 }}>{data.ngo.service_radius_km} km</span> radius
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", backgroundColor: "var(--bg-input)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
          <span>INCOMING HIGH-PRIORITY INCIDENTS ({data.notifications.length})</span>
          <span style={{ color: "var(--verified)" }}>● Live Alert System Active</span>
        </div>

        {data.notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p>No high-priority incidents currently flagged in your service radius.</p>
          </div>
        ) : (
          data.notifications.map((r) => (
            <div key={r.notification_id} style={{ padding: 16, borderBottom: "1px solid var(--border)", backgroundColor: r.notification_status === "sent" ? "rgba(245, 158, 11, 0.1)" : "var(--bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span className="tag">c/{r.category.replace("_", "")}</span>
                    <span className={`status-badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    {r.notification_status === "sent" && (
                      <span className="tag" style={{ backgroundColor: "var(--alert-muted)", color: "var(--alert)", borderColor: "var(--alert)" }}>
                        NEW ALERT
                      </span>
                    )}
                  </div>
                  <Link to={`/report/${r.id}`} style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                    {r.title}
                  </Link>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    📍 Geotag: {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · Notified {new Date(r.notified_at + "Z").toLocaleTimeString()}
                  </div>
                </div>
                <div style={{ width: 170 }}>
                  <SignalMeter pct={r.upvotePct} totalVotes={r.totalVotes} size="sm" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {r.notification_status === "sent" && (
                  <button className="btn btn-outline btn-sm" onClick={() => ack(r.notification_id)}>
                    ✓ Acknowledge Alert
                  </button>
                )}
                {r.status === "flagged" && (
                  <button className="btn btn-blue btn-sm" onClick={() => setStatus(r.id, "under_review")}>
                    🏥 Mark Under NGO Review
                  </button>
                )}
                {r.status === "under_review" && (
                  <button className="btn btn-primary btn-sm" onClick={() => setStatus(r.id, "resolved")}>
                    ✅ Mark Incident Resolved
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
