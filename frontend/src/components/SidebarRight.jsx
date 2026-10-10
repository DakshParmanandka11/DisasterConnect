import { Link } from "react-router-dom";
import { AlertTriangleIcon, CheckCircleIcon, UsersIcon } from "./Icons";

export default function SidebarRight({ config }) {
  return (
    <aside className="reddit-sidebar-right" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Widget 1: Crisis Map */}
      <div className="card" style={{ padding: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase" }}>
            CRISIS MAP
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#10b981" }}>
            <span className="live-pulse-dot" style={{ width: 5, height: 5 }} /> LIVE
          </span>
        </div>

        <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px 0", color: "var(--text-primary)" }}>
          India response view
        </h4>

        {/* Styled Dark Map Preview Card */}
        <div style={{
          position: "relative",
          height: 130,
          borderRadius: 8,
          background: "var(--bg-card-alt)",
          border: "1px solid var(--border)",
          marginBottom: 12,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {/* Decorative Vector Paths */}
          <svg width="100%" height="100%" viewBox="0 0 240 130" style={{ position: "absolute", top: 0, left: 0, opacity: 0.45 }}>
            <path d="M10 60 Q 80 10, 140 70 T 230 40" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M30 110 Q 110 40, 190 100" fill="none" stroke="#64748b" strokeWidth="1" />
            {/* Pulsing Pins */}
            <circle cx="80" cy="40" r="5" fill="#ef4444" />
            <circle cx="80" cy="40" r="10" fill="rgba(239,68,68,0.3)" />

            <circle cx="140" cy="70" r="5" fill="#f59e0b" />
            <circle cx="140" cy="70" r="9" fill="rgba(245,158,11,0.3)" />

            <circle cx="190" cy="45" r="5" fill="#ef4444" />
            <circle cx="190" cy="45" r="10" fill="rgba(239,68,68,0.3)" />

            <circle cx="50" cy="90" r="4" fill="#3b82f6" />
          </svg>
          <span style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            fontSize: 10,
            color: "var(--text-dim)",
            background: "rgba(11, 15, 25, 0.8)",
            padding: "2px 6px",
            borderRadius: 4
          }}>
            Live report locations
          </span>
        </div>

        <Link
          to="/map"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#3b82f6",
            textDecoration: "none"
          }}
        >
          Open interactive map &rsaquo;
        </Link>
      </div>

      {/* Widget 2: Response Snapshot */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Response snapshot
          </h4>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Updated live</span>
        </div>

        {/* 3 Grid Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {/* Critical Stat */}
          <div style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 8px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4
          }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangleIcon size={14} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>3</span>
            <span style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.2 }}>Critical now</span>
          </div>

          {/* Verified Stat */}
          <div style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 8px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4
          }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircleIcon size={14} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>4</span>
            <span style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.2 }}>Verified</span>
          </div>

          {/* Votes Stat */}
          <div style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 8px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4
          }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UsersIcon size={14} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>137</span>
            <span style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.2 }}>Community votes</span>
          </div>
        </div>
      </div>

      {/* Widget 3: Immediate Responders CTA */}
      <div
        className="card"
        style={{
          position: "relative",
          padding: 20,
          background: "var(--bg-card-alt)",
          border: "1px solid var(--primary-border)",
          overflow: "hidden"
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "var(--primary)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          NEED IMMEDIATE HELP?
        </span>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px 0", lineHeight: 1.3 }}>
          Connect with responders in your area.
        </h4>
        <Link
          to="/ngos"
          className="btn btn-outline"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            color: "#ffffff",
            borderColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: 8,
            fontSize: 13,
            padding: "8px 14px"
          }}
        >
          Find support &rsaquo;
        </Link>
      </div>
    </aside>
  );
}
