import { SearchIcon, FilterIcon, ShieldIcon } from "./Icons";
import "./SidebarLeft.css";

const INCIDENT_TYPES = [
  { id: "", label: "All Incidents", count: 4, color: "#3b82f6" },
  { id: "flood", label: "Flood", count: 2, color: "#3b82f6" },
  { id: "tsunami", label: "Storm", count: 1, color: "#8b5cf6" },
  { id: "earthquake", label: "Earthquake", count: 1, color: "#f59e0b" },
  { id: "fire", label: "Fire", count: 0, color: "#ef4444" },
];

const VERIFICATION_STATUSES = [
  { id: "", label: "All statuses" },
  { id: "flagged", label: "Verified & approved" },
  { id: "pending", label: "Pending review" },
];

export default function SidebarLeft({ activeCategory, onSelectCategory, activeStatus, onSelectStatus, searchQuery, onSearchChange }) {
  return (
    <aside className="reddit-sidebar-left">
      <div className="sidebar-card">
        {/* Header */}
        <div className="sidebar-card__header">
          <h3 className="sidebar-card__title">Explore reports</h3>
          <FilterIcon size={16} className="sidebar-card__icon" />
        </div>

        {/* Incident Type Section */}
        <div className="sidebar-group">
          <div className="sidebar-group__label">INCIDENT TYPE</div>
          <div className="sidebar-group__list">
            {INCIDENT_TYPES.map((item) => {
              const isSelected = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar-filter-item ${isSelected ? "active" : ""}`}
                  onClick={() => onSelectCategory(item.id)}
                >
                  <div className="sidebar-filter-item__left">
                    <span
                      className="sidebar-filter-item__dot"
                      style={{ background: item.color }}
                    />
                    <span className="sidebar-filter-item__label">{item.label}</span>
                  </div>
                  <span className="sidebar-filter-item__count">{item.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Verification Section */}
        <div className="sidebar-group">
          <div className="sidebar-group__label">VERIFICATION</div>
          <div className="sidebar-group__list">
            {VERIFICATION_STATUSES.map((item) => {
              const isSelected = activeStatus === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar-radio-item ${isSelected ? "active" : ""}`}
                  onClick={() => onSelectStatus(item.id)}
                >
                  <span className={`sidebar-radio-circle ${isSelected ? "selected" : ""}`}>
                    {isSelected && <span className="sidebar-radio-inner" />}
                  </span>
                  <span className="sidebar-radio-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* How Verification Works CTA */}
        <div className="sidebar-cta-container">
          <button
            className="sidebar-cta-btn"
            onClick={() => alert("Verification Pipeline:\n\n1. Reports geotagged within 10 km.\n2. Community members upvote/downvote.\n3. >40% upvotes (min 10 votes) triggers Community Verified status.\n4. Senior Moderators & Relief NGOs verify and dispatch assistance.")}
          >
            <ShieldIcon size={16} />
            <span>How verification works</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
