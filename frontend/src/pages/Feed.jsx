import { useEffect, useState } from "react";
import { api } from "../api/client";
import ReportRow from "../components/ReportRow";
import SidebarLeft from "../components/SidebarLeft";
import SidebarRight from "../components/SidebarRight";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { ChevronDownIcon } from "../components/Icons";

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
  const [searchQuery, setSearchQuery] = useState("");

  const statusFilter = propStatus !== undefined ? propStatus : localStatus;
  const setStatusFilter = propSetStatus || setLocalStatus;
  const categoryFilter = propCategory !== undefined ? propCategory : localCategory;
  const setCategoryFilter = propSetCategory || setLocalCategory;

  const [sortOrder, setSortOrder] = useState("urgent");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
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

  // Filter by search query if any
  const filteredList = reports.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q))
    );
  });

  // Sort list
  const sortedList = [...filteredList].sort((a, b) => {
    if (sortOrder === "urgent") {
      const urgencyA = (a.status === "flagged" ? 10 : 0) + (a.upvotes || 0);
      const urgencyB = (b.status === "flagged" ? 10 : 0) + (b.upvotes || 0);
      return urgencyB - urgencyA;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="container">
      {/* Figma Hero Header Section */}
      <div className="feed-hero-section">
        <div className="feed-hero-section__left">
          <div className="feed-hero-subtitle">
            COMMUNITY-VERIFIED INTELLIGENCE
          </div>
          <h1 className="feed-hero-title">Incidents happening now</h1>
          <p className="feed-hero-desc">
            Real-time reports from people on the ground, reviewed by the community and moderators.
          </p>
        </div>

        <div className="feed-hero-section__right">
          <div className="feed-live-badge">
            <span className="live-pulse-dot" />
            <span>Live updates</span>
            <span className="feed-live-count">{sortedList.length}</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div className="reddit-grid">
        <SidebarLeft
          activeCategory={categoryFilter}
          onSelectCategory={setCategoryFilter}
          activeStatus={statusFilter}
          onSelectStatus={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="feed-main-col">
          {/* List Controls Row matching Figma */}
          <div className="feed-list-controls">
            <div className="feed-list-count">
              <strong>{sortedList.length}</strong> reports
            </div>

            <div className="feed-sort-dropdown">
              <button
                className="feed-sort-dropdown__btn"
                onClick={() => setSortOrder((s) => (s === "urgent" ? "newest" : "urgent"))}
              >
                <span>{sortOrder === "urgent" ? "Most urgent" : "Newest first"}</span>
                <ChevronDownIcon size={14} />
              </button>
            </div>
          </div>

          {/* Incidents List */}
          {loading ? (
            <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading live incident feed…
            </div>
          ) : sortedList.length === 0 ? (
            <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ marginBottom: 12, fontSize: 14 }}>No incidents found matching your filter criteria.</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setCategoryFilter(""); setStatusFilter(""); setSearchQuery(""); }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            sortedList.map((report) => (
              <ReportRow key={report.id} report={report} config={config} />
            ))
          )}
        </main>

        <SidebarRight config={config} />
      </div>

      <style>{`
        .feed-hero-section {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 24px 0 16px 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
          gap: 16px;
        }

        .feed-hero-subtitle {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #60a5fa;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .feed-hero-title {
          font-size: 30px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
        }

        .feed-hero-desc {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }

        .feed-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 6px 14px;
          border-radius: var(--radius-full);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .feed-live-count {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 10px;
        }

        .feed-list-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .feed-list-count {
          font-size: 13px;
          color: var(--text-muted);
        }

        .feed-list-count strong {
          color: var(--text-primary);
        }

        .feed-sort-dropdown__btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 12px;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition);
        }

        .feed-sort-dropdown__btn:hover {
          color: var(--text-primary);
          border-color: var(--text-muted);
        }

        @media (max-width: 640px) {
          .feed-hero-section {
            flex-direction: column;
            align-items: flex-start;
          }
          .feed-hero-title {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
