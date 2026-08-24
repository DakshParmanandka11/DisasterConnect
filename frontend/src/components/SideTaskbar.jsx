import { useEffect } from "react";
import "./SideTaskbar.css";

const CHANNELS = [
  { id: "", label: "c/all-incidents", icon: "🌐" },
  { id: "flood", label: "c/flooding", icon: "🌊" },
  { id: "fire", label: "c/wildfires", icon: "🔥" },
  { id: "earthquake", label: "c/earthquake", icon: "🌋" },
  { id: "accident", label: "c/accidents", icon: "💥" },
  { id: "building_collapse", label: "c/structural-collapse", icon: "🏚️" },
  { id: "gas_leak", label: "c/gas-hazard", icon: "⚠️" },
  { id: "other", label: "c/other-calamities", icon: "📍" },
];

export default function SideTaskbar({ isOpen, onClose, activeCategory, onSelectCategory, activeStatus, onSelectStatus }) {
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
          <div className="taskbar-title">
            <span>📂</span> Channels &amp; Filters
          </div>
          <button className="taskbar-close-btn" onClick={onClose} title="Close taskbar">
            ✕
          </button>
        </div>

        <div className="taskbar-body">
          {/* Feed Filter Section */}
          <div className="taskbar-section">
            <div className="taskbar-section-title">STATUS FEEDS</div>
            <div className="taskbar-btn-group">
              <button
                className={`taskbar-btn ${activeStatus === "" ? "active" : ""}`}
                onClick={() => { onSelectStatus(""); onClose(); }}
              >
                <span>🔥</span> All Active Feeds
              </button>
              <button
                className={`taskbar-btn ${activeStatus === "flagged" ? "active-alert" : ""}`}
                onClick={() => { onSelectStatus("flagged"); onClose(); }}
              >
                <span>🚨</span> High Priority (&gt;40%)
              </button>
              <button
                className={`taskbar-btn ${activeStatus === "pending" ? "active-amber" : ""}`}
                onClick={() => { onSelectStatus("pending"); onClose(); }}
              >
                <span>⏳</span> Pending Quorum
              </button>
              <button
                className={`taskbar-btn ${activeStatus === "under_review" ? "active-intel" : ""}`}
                onClick={() => { onSelectStatus("under_review"); onClose(); }}
              >
                <span>🏥</span> NGO Review
              </button>
            </div>
          </div>

          {/* Category Channels Section */}
          <div className="taskbar-section">
            <div className="taskbar-section-title">CATEGORY CHANNELS</div>
            <div className="taskbar-btn-group">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  className={`taskbar-btn ${activeCategory === ch.id ? "active-intel" : ""}`}
                  onClick={() => { onSelectCategory(ch.id); onClose(); }}
                >
                  <span>{ch.icon}</span> {ch.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
