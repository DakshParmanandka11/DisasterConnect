import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HomeIcon, MapPinIcon, AlertTriangleIcon, ShieldIcon, UsersIcon,
  ClipboardIcon, KeyIcon
} from "./Icons";
import "./SidebarLeft.css";

const CHANNELS = [
  { id: "", label: "All" },
  { id: "flood", label: "Flooding" },
  { id: "fire", label: "Fire" },
  { id: "earthquake", label: "Earthquake" },
  { id: "tsunami", label: "Tsunami / Cyclone" },
  { id: "landslide", label: "Landslide" },
  { id: "building_collapse", label: "Structural Collapse" },
  { id: "other", label: "Other" },
];

export default function SidebarLeft({ activeCategory, onSelectCategory, activeStatus, onSelectStatus }) {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role || null;
  const isHome = location.pathname === "/";

  return (
    <aside className="reddit-sidebar-left">
      <div className="sidebar-section-title">Navigation</div>

      <Link
        to="/"
        className={`sidebar-item ${isHome && !activeStatus && !activeCategory ? "active" : ""}`}
      >
        <HomeIcon size={14} /> Home
      </Link>

      <Link to="/map" className={`sidebar-item ${location.pathname === "/map" ? "active" : ""}`}>
        <MapPinIcon size={14} /> Crisis Map
      </Link>

      {role === "citizen" && (
        <Link to="/ngos" className={`sidebar-item ${location.pathname === "/ngos" ? "active" : ""}`}>
          <UsersIcon size={14} /> NGO Network
        </Link>
      )}

      {(role === "ngo" || role === "admin") && (
        <>
          <Link to="/ngos" className={`sidebar-item ${location.pathname === "/ngos" ? "active" : ""}`}>
            <UsersIcon size={14} /> NGO Network
          </Link>
          <Link to="/ngo" className={`sidebar-item ${location.pathname === "/ngo" ? "active" : ""}`}>
            <ClipboardIcon size={14} /> NGO Dashboard
          </Link>
        </>
      )}

      {(role === "moderator" || role === "admin") && (
        <Link to="/moderator" className={`sidebar-item ${location.pathname === "/moderator" ? "active" : ""}`}>
          <ShieldIcon size={14} /> Moderation
        </Link>
      )}



      <div className="sidebar-divider" />

      <div className="sidebar-section-title">Status</div>
      <button
        className={`sidebar-item ${isHome && activeStatus === "" ? "active" : ""}`}
        onClick={() => onSelectStatus("")}
      >
        All Active
      </button>
      <button
        className={`sidebar-item ${activeStatus === "flagged" ? "active" : ""}`}
        onClick={() => onSelectStatus("flagged")}
      >
        High Priority
      </button>
      <button
        className={`sidebar-item ${activeStatus === "pending" ? "active" : ""}`}
        onClick={() => onSelectStatus("pending")}
      >
        Pending Verification
      </button>
      <button
        className={`sidebar-item ${activeStatus === "under_review" ? "active" : ""}`}
        onClick={() => onSelectStatus("under_review")}
      >
        Under Review
      </button>

      <div className="sidebar-divider" />

      <div className="sidebar-section-title">Category</div>
      {CHANNELS.map((ch) => (
        <button
          key={ch.id}
          className={`sidebar-item ${activeCategory === ch.id ? "active" : ""}`}
          onClick={() => onSelectCategory(ch.id)}
        >
          {ch.label}
        </button>
      ))}
    </aside>
  );
}
