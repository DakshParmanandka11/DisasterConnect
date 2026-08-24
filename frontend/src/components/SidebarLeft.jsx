import { Link, useLocation } from "react-router-dom";
import "./SidebarLeft.css";

const CHANNELS = [
  { id: "", label: "All Incidents", icon: "🌐" },
  { id: "flood", label: "Flooding", icon: "🌊" },
  { id: "fire", label: "Wildfires", icon: "🔥" },
  { id: "earthquake", label: "Earthquake", icon: "🌋" },
  { id: "accident", label: "Accidents", icon: "💥" },
  { id: "building_collapse", label: "Structural Collapse", icon: "🏚️" },
  { id: "gas_leak", label: "Gas Hazard", icon: "⚠️" },
  { id: "other", label: "Other Calamities", icon: "📍" },
];

export default function SidebarLeft({ activeCategory, onSelectCategory, activeStatus, onSelectStatus }) {
  const location = useLocation();

  return (
    <aside className="reddit-sidebar-left">
      {/* Main navigation */}
      <Link
        to="/"
        className={`sidebar-item ${location.pathname === "/" && !activeStatus && !activeCategory ? "active" : ""}`}
      >
        <span className="sidebar-icon">🏠</span>
        <span>Home</span>
      </Link>
      <Link to="/map" className={`sidebar-item ${location.pathname === "/map" ? "active-intel" : ""}`}>
        <span className="sidebar-icon">🗺️</span>
        <span>Live Crisis Map</span>
      </Link>
      <Link to="/report/new" className={`sidebar-item ${location.pathname === "/report/new" ? "active-alert" : ""}`}
        style={{ color: "var(--alert)", fontWeight: 700 }}>
        <span className="sidebar-icon">📷</span>
        <span>Report Incident</span>
      </Link>

      <div className="sidebar-divider" />

      {/* Status Feeds */}
      <div className="sidebar-section-title">STATUS FEEDS</div>
      <button className={`sidebar-item ${activeStatus === "" && location.pathname === "/" ? "active" : ""}`}
        onClick={() => onSelectStatus("")}>
        <span className="sidebar-icon">🔥</span>
        <span>All Active</span>
      </button>
      <button className={`sidebar-item ${activeStatus === "flagged" ? "active-alert" : ""}`}
        onClick={() => onSelectStatus("flagged")}>
        <span className="sidebar-icon">🚨</span>
        <span>High Priority</span>
      </button>
      <button className={`sidebar-item ${activeStatus === "pending" ? "active" : ""}`}
        onClick={() => onSelectStatus("pending")}>
        <span className="sidebar-icon">⏳</span>
        <span>Pending Quorum</span>
      </button>
      <button className={`sidebar-item ${activeStatus === "under_review" ? "active-intel" : ""}`}
        onClick={() => onSelectStatus("under_review")}>
        <span className="sidebar-icon">🏥</span>
        <span>NGO Review</span>
      </button>

      <div className="sidebar-divider" />

      {/* Disaster Category Channels */}
      <div className="sidebar-section-title">DISASTER CHANNELS</div>
      {CHANNELS.map((ch) => (
        <button
          key={ch.id}
          className={`sidebar-item ${activeCategory === ch.id ? "active-intel" : ""}`}
          onClick={() => onSelectCategory(ch.id)}
        >
          <span className="sidebar-icon">{ch.icon}</span>
          <span>{ch.label}</span>
        </button>
      ))}
    </aside>
  );
}
