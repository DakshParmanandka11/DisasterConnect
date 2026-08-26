import { useEffect, useState } from "react";
import { api } from "../api/client";
import { socket } from "../api/socket";
import ReportRow from "../components/ReportRow";
import SidebarLeft from "../components/SidebarLeft";
import SidebarRight from "../components/SidebarRight";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { LayersIcon, AlertTriangleIcon } from "../components/Icons";

export default function Feed({
  activeCategory: propCategory,
  onSelectCategory: propSetCategory,
  activeStatus: propStatus,
  onSelectStatus: propSetStatus,
}) {
  const [reports, setReports] = useState([]);
  const [config, setConfig] = useState(null);
  const [localStatus, setLocalStatus] = useState("");
  const [localCategory, setLocalCategory] = useState("");

  const statusFilter = propStatus !== undefined ? propStatus : localStatus;
  const setStatusFilter = propSetStatus || setLocalStatus;
  const categoryFilter = propCategory !== undefined ? propCategory : localCategory;
  const setCategoryFilter = propSetCategory || setLocalCategory;

  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const { user } = useAuth();

  useEffect(() => { api.config().then(setConfig).catch(() => {}); }, []);

  function fetchFeed(isInitial = false) {
    if (isInitial) setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    api.listReports(params)
      .then((data) => {
        if (data && Array.isArray(data.reports)) {
          setReports(data.reports);
          setLive(true);
          setTimeout(() => setLive(false), 1000);
        }
      })
      .catch(() => {})
      .finally(() => { if (isInitial) setLoading(false); });
  }

  useEffect(() => {
    fetchFeed(true);
    const timer = setInterval(() => fetchFeed(false), 5000);
    return () => clearInterval(timer);
  }, [statusFilter, categoryFilter]);

  function getDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function groupReportsByLocation(list) {
    const groups = [];
    const visited = new Set();
    for (const r of list) {
      if (visited.has(r.id)) continue;
      const related = list.filter((other) => {
        if (visited.has(other.id)) return false;
        if (r.cluster_id && other.cluster_id && r.cluster_id === other.cluster_id) return true;
        return getDistanceKm(r.lat, r.lng, other.lat, other.lng) <= 1.0;
      });
      related.forEach((item) => visited.add(item.id));
      groups.push(related);
    }
    return groups;
  }

  const sortedList = [...reports].sort((a, b) =>
    sortOrder === "hot"
      ? (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
      : new Date(b.created_at) - new Date(a.created_at)
  );

  const clusteredGroups = groupReportsByLocation(sortedList);

  return (
    <div className="container">
      <div className="reddit-grid">
        <SidebarLeft
          activeCategory={categoryFilter}
          onSelectCategory={setCategoryFilter}
          activeStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />

        <main className="feed-main-col">
          {/* Compose / Report bar */}
          <div className="feed-compose-bar">
            <div className="feed-compose-bar__avatar">
              {user ? user.name.charAt(0).toUpperCase() : "?"}
            </div>
            <Link
              to={user ? "/report/new" : "/login"}
              className="feed-compose-bar__input"
              aria-label="Submit a new incident report"
            >
              Describe the disaster or calamity in your area…
            </Link>
            <Link
              to={user ? "/report/new" : "/login"}
              className="btn btn-primary btn-sm feed-compose-bar__btn"
            >
              <AlertTriangleIcon size={13} />
              Report
            </Link>
          </div>

          {/* Sort / filter bar */}
          <div className="feed-sort-bar">
            <div className="feed-sort-bar__left">
              <button
                className={`feed-sort-btn ${sortOrder === "newest" ? "active" : ""}`}
                onClick={() => setSortOrder("newest")}
              >
                New
              </button>
              <button
                className={`feed-sort-btn ${sortOrder === "hot" ? "active" : ""}`}
                onClick={() => setSortOrder("hot")}
              >
                Top
              </button>
              <span className="feed-cluster-label">
                <LayersIcon size={12} />
                Location clusters on
              </span>
            </div>
            <div className="feed-sort-bar__live">
              <span className={`feed-live-dot ${live ? "feed-live-dot--live" : ""}`} />
              {live ? "Live" : "Connected"}
            </div>
          </div>

          {/* Incidents */}
          {loading ? (
            <div className="card" style={{ padding: "36px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading incident feed…
            </div>
          ) : clusteredGroups.length === 0 ? (
            <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ marginBottom: 12, fontSize: 14 }}>No incidents reported. Submit the first report for this area.</p>
              <Link to={user ? "/report/new" : "/login"} className="btn btn-primary btn-sm">
                Submit a report
              </Link>
            </div>
          ) : (
            clusteredGroups.map((group) => {
              if (group.length === 1) {
                return <ReportRow key={group[0].id} report={group[0]} config={config} />;
              }
              return (
                <div key={`cluster-${group[0].id}`} className="feed-cluster-group">
                  <div className="feed-cluster-header">
                    <LayersIcon size={13} />
                    <span>{group.length} reports from the same area — within 1 km radius</span>
                  </div>
                  <div className="feed-cluster-body">
                    {group.map((r) => (
                      <ReportRow key={r.id} report={r} config={config} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </main>

        <SidebarRight config={config} />
      </div>

      <style>{`
        .feed-compose-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          margin-bottom: 8px;
        }
        .feed-compose-bar__avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-card-alt);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .feed-compose-bar__input {
          flex: 1;
          min-width: 0;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 7px 12px;
          font-size: 13px;
          color: var(--text-dim);
          display: block;
          transition: border-color var(--transition);
        }
        .feed-compose-bar__input:hover { border-color: var(--text-muted); }
        .feed-compose-bar__btn { flex-shrink: 0; }

        .feed-sort-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 12px;
          margin-bottom: 8px;
          gap: 8px;
          flex-wrap: wrap;
        }
        .feed-sort-bar__left {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .feed-sort-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: var(--radius-xs);
          cursor: pointer;
          transition: all var(--transition);
        }
        .feed-sort-btn:hover { background: var(--bg-card-alt); color: var(--text-primary); }
        .feed-sort-btn.active { background: var(--primary-bg); color: var(--primary); font-weight: 600; }

        .feed-cluster-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-dim);
          padding: 3px 8px;
          border-radius: var(--radius-xs);
          border: 1px solid var(--border-muted);
          margin-left: 4px;
        }

        .feed-sort-bar__live {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--text-dim);
        }
        .feed-live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green); flex-shrink: 0;
        }
        .feed-live-dot--live { background: var(--red); }

        .feed-cluster-group {
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          margin-bottom: 10px;
          overflow: hidden;
        }
        .feed-cluster-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: var(--primary-bg);
          border-bottom: 1px solid var(--primary-border);
          color: var(--primary);
          font-size: 12px;
          font-weight: 500;
        }
        .feed-cluster-body {
          display: flex;
          flex-direction: column;
        }
        .feed-cluster-body .rp-card:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  );
}
