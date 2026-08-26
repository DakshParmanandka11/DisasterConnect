import { Link } from "react-router-dom";

export default function SidebarRight({ config, onRunDemo }) {
  return (
    <aside className="reddit-sidebar-right" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* About Card */}
      <div className="card" style={{ padding: 16 }}>
        <h4 style={{ fontSize: 14, margin: "0 0 8px 0" }}>About DisasterConnect</h4>
        <p style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5, margin: "0 0 12px 0" }}>
          Community-verified emergency reporting. Reports are geotagged and verified by nearby users within proximity.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, borderTop: "1px solid var(--border-muted)", paddingTop: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Voting Radius</span>
            <strong style={{ color: "var(--text-primary)" }}>
              {config?.voting_radius_km ?? 10} km
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Flagging Threshold</span>
            <strong style={{ color: "var(--text-primary)" }}>
              &gt;{config?.verification_threshold_pct ?? 40}% upvotes
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Min Quorum</span>
            <strong style={{ color: "var(--text-primary)" }}>{config?.min_vote_quorum ?? 10} votes</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>NGO Dispatch Range</span>
            <strong style={{ color: "var(--text-primary)" }}>{config?.ngo_notify_radius_km ?? 25} km</strong>
          </div>
        </div>

        <Link to="/report/new" className="btn btn-signal" style={{ width: "100%", borderRadius: "var(--radius-full)" }}>
          + New Report
        </Link>
      </div>

      {/* How it works */}
      <div className="card" style={{ padding: 16 }}>
        <h4 style={{ fontSize: 14, margin: "0 0 8px 0" }}>How Verification Works</h4>
        <ol style={{ paddingLeft: 16, margin: 0, fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4, lineHeight: 1.5 }}>
          <li>Submit a report with geotag and photos.</li>
          <li>Users within <strong>10 km</strong> upvote or downvote.</li>
          <li>At <strong>&gt;40% upvotes</strong> (min 10 votes), system flags the incident.</li>
          <li>Nearby relief NGOs are notified for response.</li>
        </ol>
      </div>

      {onRunDemo && (
        <div className="card" style={{ padding: 16 }}>
          <h4 style={{ fontSize: 13, margin: "0 0 6px 0" }}>Quick Actions</h4>
          <p style={{ fontSize: 12, color: "var(--text-body)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
            Test the live verification pipeline or explore the crisis map.
          </p>
          <Link to="/map" className="btn btn-outline btn-sm" style={{ width: "100%" }}>
            Open Crisis Map
          </Link>
        </div>
      )}
    </aside>
  );
}
