import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HomeIcon, MapPinIcon, AlertTriangleIcon, ShieldIcon, UsersIcon,
  ClipboardIcon, KeyIcon, XIcon
} from "./Icons";
import "./SideTaskbar.css";

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

export default function SideTaskbar({ isOpen, onClose, activeCategory, onSelectCategory, activeStatus, onSelectStatus }) {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role || null;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="taskbar-overlay" onClick={onClose}>
      <aside className="taskbar-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="taskbar-header">
          <span className="taskbar-title">DisasterConnect</span>
          <button className="taskbar-close-btn" onClick={onClose} title="Close" aria-label="Close menu">
            <XIcon size={15} />
          </button>
        </div>

        <div className="taskbar-body">
          {/* Navigation */}
          <div className="taskbar-section">
            <div className="taskbar-section-title">Navigation</div>
            <div className="taskbar-btn-group">
              <Link to="/" className={`taskbar-btn ${location.pathname === "/" ? "active" : ""}`} onClick={onClose}>
                <HomeIcon size={14} /> Home
              </Link>
              <Link to="/map" className={`taskbar-btn ${location.pathname === "/map" ? "active" : ""}`} onClick={onClose}>
                <MapPinIcon size={14} /> Crisis Map
              </Link>

              {(role === "citizen" || !user) && (
                <Link to="/ngos" className={`taskbar-btn ${location.pathname === "/ngos" ? "active" : ""}`} onClick={onClose}>
                  <UsersIcon size={14} /> NGO Network
                </Link>
              )}
              {role === "ngo" && (
                <>
                  <Link to="/ngos" className={`taskbar-btn ${location.pathname === "/ngos" ? "active" : ""}`} onClick={onClose}>
                    <UsersIcon size={14} /> NGO Network
                  </Link>
                  <Link to="/ngo" className={`taskbar-btn ${location.pathname === "/ngo" ? "active" : ""}`} onClick={onClose}>
                    <ClipboardIcon size={14} /> NGO Dashboard
                  </Link>
                </>
              )}
              {role === "admin" && (
                <>
                  <Link to="/ngos" className={`taskbar-btn ${location.pathname === "/ngos" ? "active" : ""}`} onClick={onClose}>
                    <UsersIcon size={14} /> NGO Network
                  </Link>
                  <Link to="/ngo" className={`taskbar-btn ${location.pathname === "/ngo" ? "active" : ""}`} onClick={onClose}>
                    <ClipboardIcon size={14} /> NGO Dashboard
                  </Link>
                </>
              )}
              {(role === "moderator" || role === "admin") && (
                <Link to="/moderator" className={`taskbar-btn ${location.pathname === "/moderator" ? "active" : ""}`} onClick={onClose}>
                  <ShieldIcon size={14} /> Moderation
                </Link>
              )}
            </div>
          </div>

          {/* Status — Only visible to Moderators and Admin profiles */}
          {(role === "admin" || role === "moderator" || role === "student_moderator" || role === "senior_moderator") && (
            <div className="taskbar-section">
              <div className="taskbar-section-title">Status</div>
              <div className="taskbar-btn-group">
                {[
                  { val: "", label: "All Active" },
                  { val: "flagged", label: "High Priority" },
                  { val: "pending", label: "Pending Verification" },
                  { val: "under_review", label: "Under Review" },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    className={`taskbar-btn ${activeStatus === val ? "active" : ""}`}
                    onClick={() => { onSelectStatus(val); onClose(); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="taskbar-section">
            <div className="taskbar-section-title">Category</div>
            <div className="taskbar-btn-group">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  className={`taskbar-btn ${activeCategory === ch.id ? "active" : ""}`}
                  onClick={() => { onSelectCategory(ch.id); onClose(); }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
