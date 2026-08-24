import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar({ onToggleTaskbar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("dc_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dc_theme", theme);
  }, [theme]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        {/* Left: Hamburger menu (opens side channels drawer) + Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="navbar__hamburger"
            onClick={onToggleTaskbar}
            title="Open Channels & Filters"
            aria-label="Open menu"
          >
            ☰
          </button>

          <Link to="/" className="navbar__brand">
            <div className="navbar__brand-icon">🚨</div>
            <span>Disaster<span style={{ color: "var(--alert)" }}>Connect</span></span>
          </Link>
        </div>

        {/* Center: Search bar */}
        <div className="navbar__search">
          <span className="navbar__search-icon">🔍</span>
          <input placeholder="Search incidents, locations..." />
        </div>

        {/* Right: Nav items + Three-Dot Menu Dropdown */}
        <nav className="navbar__links">
          <Link to="/" className={`navbar__nav-item ${location.pathname === "/" ? "active" : ""}`}>
            🔥 <span>Feed</span>
          </Link>
          <Link to="/map" className={`navbar__nav-item ${location.pathname === "/map" ? "active" : ""}`}>
            🗺️ <span>Map</span>
          </Link>

          {user && user.role === "ngo" && (
            <Link to="/ngo" className={`navbar__nav-item ${location.pathname === "/ngo" ? "active" : ""}`}>
              🏥 <span>NGO</span>
            </Link>
          )}

          {/* ─── THREE-DOT ICON MENU (⋮) ─── */}
          <div className="navbar__menu-container" ref={menuRef}>
            <button
              className={`navbar__menu-btn ${menuOpen ? "active" : ""}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              title="More Options"
              aria-label="Toggle options menu"
            >
              ⋯
            </button>

            {menuOpen && (
              <div className="navbar__dropdown">
                {user ? (
                  <>
                    <div className="navbar__dropdown-user">
                      <div className="navbar__avatar">{user.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{user.role} Account</div>
                      </div>
                    </div>
                    <div className="navbar__dropdown-divider navbar__dropdown-item--mobile-only" />
                    <Link to="/" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                      <span>🔥</span> Home Feed
                    </Link>
                    <Link to="/map" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                      <span>🗺️</span> Live Crisis Map
                    </Link>
                    <Link to="/report/new" className="navbar__dropdown-item" style={{ color: "var(--alert)", fontWeight: 700 }} onClick={() => setMenuOpen(false)}>
                      <span>🚨</span> + Report Incident
                    </Link>
                    {user.role === "ngo" && (
                      <Link to="/ngo" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                        <span>🏥</span> NGO Dashboard
                      </Link>
                    )}
                    <div className="navbar__dropdown-divider" />
                    <button className="navbar__dropdown-item" onClick={toggleTheme}>
                      <span>{theme === "dark" ? "☀️" : "🌙"}</span> {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </button>
                    <button
                      className="navbar__dropdown-item"
                      style={{ color: "var(--alert)" }}
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                        navigate("/");
                      }}
                    >
                      <span>🚪</span> Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="navbar__dropdown-header">ACCOUNT</div>
                    <Link to="/login" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                      <span>🔑</span> Log In
                    </Link>
                    <Link to="/register" className="navbar__dropdown-item" style={{ color: "var(--alert)", fontWeight: 700 }} onClick={() => setMenuOpen(false)}>
                      <span>📝</span> Sign Up
                    </Link>
                    <div className="navbar__dropdown-divider navbar__dropdown-item--mobile-only" />
                    <Link to="/" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                      <span>🔥</span> Home Feed
                    </Link>
                    <Link to="/map" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                      <span>🗺️</span> Live Crisis Map
                    </Link>
                    <div className="navbar__dropdown-divider" />
                    <button className="navbar__dropdown-item" onClick={toggleTheme}>
                      <span>{theme === "dark" ? "☀️" : "🌙"}</span> {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
