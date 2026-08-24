import { Link } from "react-router-dom";

export default function SidebarRight({ config, onRunDemo }) {
  return (
    <aside className="reddit-sidebar-right" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Community Info Card */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            height: 44,
            background: "linear-gradient(135deg, #FF4500 0%, #FF6825 100%)",
            padding: "12px 16px",
            color: "white",
            fontWeight: 800,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🛡️</span> About r/DisasterConnect
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5, margin: "0 0 12px 0" }}>
            A community-verified emergency reporting platform. Reports are geotagged instantly and verified by locals within proximity.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, borderTop: "1px solid var(--border-muted)", paddingTop: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Voting Radius:</span>
              <strong className="mono" style={{ color: "var(--intel)" }}>
                {config?.voting_radius_km ?? 10} km
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Flagging Threshold:</span>
              <strong className="mono" style={{ color: "var(--alert)" }}>
                &gt;{config?.verification_threshold_pct ?? 40}% Upvotes
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Min Quorum:</span>
              <strong className="mono">{config?.min_vote_quorum ?? 10} votes</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>NGO Dispatch Radius:</span>
              <strong className="mono">{config?.ngo_notify_radius_km ?? 25} km</strong>
            </div>
          </div>

          <Link to="/report/new" className="btn btn-signal" style={{ width: "100%", borderRadius: "var(--radius-full)" }}>
            + Create Report
          </Link>
        </div>
      </div>

      {/* Verification Rules Card */}
      <div className="card" style={{ padding: 16 }}>
        <h4 style={{ fontSize: 14, margin: "0 0 8px 0" }}>⚡ How Verification Works</h4>
        <ol style={{ paddingLeft: 16, margin: 0, fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.4 }}>
          <li>Submit report with geotag + photos/video.</li>
          <li>Users within <strong>10 km</strong> upvote/downvote.</li>
          <li>At <strong>&gt;40% upvotes</strong> (min 10 votes), system auto-flags incident.</li>
          <li>Nearby relief NGOs get notified instantly.</li>
        </ol>
      </div>

      {/* Quick Demo Simulator Tool Widget */}
      {onRunDemo && (
        <div className="card" style={{ padding: 16, backgroundColor: "rgba(245, 158, 11, 0.12)", borderColor: "rgba(245, 158, 11, 0.3)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--amber)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚡</span> Demo Shortcut
          </div>
          <p style={{ fontSize: 12, color: "var(--text-body)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
            Test the live auto-flagging pipeline instantly on any report without manual multi-account voting.
          </p>
          <Link to="/map" className="btn btn-outline btn-sm" style={{ width: "100%", borderColor: "var(--amber)", color: "var(--amber)" }}>
            Explore Crisis Map
          </Link>
        </div>
      )}
    </aside>
  );
}
