import { useEffect, useState } from "react";
import { api } from "../api/client";
import { socket } from "../api/socket";
import ReportRow from "../components/ReportRow";
import SidebarLeft from "../components/SidebarLeft";
import SidebarRight from "../components/SidebarRight";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

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

  // Use props if passed from App.jsx (controlled by taskbar), else use local state
  const statusFilter = propStatus !== undefined ? propStatus : localStatus;
  const setStatusFilter = propSetStatus || setLocalStatus;
  const categoryFilter = propCategory !== undefined ? propCategory : localCategory;
  const setCategoryFilter = propSetCategory || setLocalCategory;

  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    api.listReports(params)
      .then((data) => setReports(data.reports))
      .finally(() => setLoading(false));
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    function flashLive() {
      setLive(true);
      setTimeout(() => setLive(false), 1200);
    }
    function upsert(report) {
      flashLive();
      setReports((prev) => {
        const matchesFilter =
          (!statusFilter || report.status === statusFilter) &&
          (!categoryFilter || report.category === categoryFilter);
        const idx = prev.findIndex((r) => r.id === report.id);
        if (idx === -1) return matchesFilter ? [report, ...prev] : prev;
        const copy = [...prev];
        if (matchesFilter) copy[idx] = report;
        else copy.splice(idx, 1);
        return copy;
      });
    }
    socket.on("report:new", upsert);
    socket.on("report:updated", upsert);
    socket.on("report:flagged", upsert);
    return () => {
      socket.off("report:new", upsert);
      socket.off("report:updated", upsert);
      socket.off("report:flagged", upsert);
    };
  }, [statusFilter, categoryFilter]);

  const displayed = [...reports].sort((a, b) =>
    sortOrder === "hot"
      ? (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
      : new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className="container">
      <div className="reddit-grid">

        {/* ── Left navigation sidebar (desktop only, hidden on mobile) ── */}
        <SidebarLeft
          activeCategory={categoryFilter}
          onSelectCategory={setCategoryFilter}
          activeStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />

        {/* ── Centre feed column ── */}
        <main className="feed-main-col">

          {/* Hero Report Button Card */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "var(--alert)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 18,
            }}>
              {user ? user.name.charAt(0).toUpperCase() : "👤"}
            </div>
            <Link to="/report/new" style={{
              flex: 1,
              minWidth: 0,
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xs)",
              padding: "9px 14px",
              fontSize: 14,
              color: "var(--text-dim)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              display: "block",
            }}>
              📷 Report a disaster or calamity in your area...
            </Link>
            <Link to="/report/new" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
              + Report
            </Link>
          </div>

          {/* Sort / Filter Bar */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 14px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className={`btn btn-sm ${sortOrder === "newest" ? "btn-outline" : "btn-ghost"}`}
                style={{ color: sortOrder === "newest" ? "var(--alert)" : "var(--text-muted)", borderColor: sortOrder === "newest" ? "var(--alert)" : "transparent" }}
                onClick={() => setSortOrder("newest")}
              >
                ✨ New
              </button>
              <button
                className={`btn btn-sm ${sortOrder === "hot" ? "btn-outline" : "btn-ghost"}`}
                style={{ color: sortOrder === "hot" ? "var(--alert)" : "var(--text-muted)", borderColor: sortOrder === "hot" ? "var(--alert)" : "transparent" }}
                onClick={() => setSortOrder("hot")}
              >
                🔥 Top
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: live ? "var(--alert)" : "var(--verified)",
                boxShadow: live ? "0 0 0 3px var(--alert-muted)" : "none",
                flexShrink: 0,
              }} />
              {live ? "Live" : "Connected"}
            </div>
          </div>

          {/* Incident list */}
          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Loading incident feed…
            </div>
          ) : displayed.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <p>No incidents found. Be the first to report one.</p>
              <Link to="/report/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                + Report Incident
              </Link>
            </div>
          ) : (
            displayed.map((r) => <ReportRow key={r.id} report={r} config={config} />)
          )}
        </main>

        {/* ── Right sidebar (community info, hidden on mobile) ── */}
        <SidebarRight config={config} />
      </div>
    </div>
  );
}
