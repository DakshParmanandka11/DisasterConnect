import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HomeIcon, MapPinIcon, AlertTriangleIcon, ShieldIcon, UsersIcon,
  SunIcon, MoonIcon, LogOutIcon, MenuIcon, BellIcon, PlusIcon
} from "./Icons";
import "./Navbar.css";

export default function Navbar({ onToggleTaskbar, activeReportCount = 4 }) {
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const role = user?.role || null;
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <header className="navbar-wrapper">
      <nav className="navbar">
        <div className="navbar__inner">
          {/* Left Brand */}
          <div className="navbar__left">
            <button
              className="navbar__hamburger"
              onClick={onToggleTaskbar}
              title="Toggle sidebar navigation"
              aria-label="Open menu"
            >
              <MenuIcon size={18} />
            </button>

            <Link to="/" className="navbar__brand">
              <div className="navbar__brand-icon">
                <ShieldIcon size={18} />
              </div>
              <span className="navbar__brand-text">DisasterConnect</span>
            </Link>
          </div>

          {/* Center Pill Navigation */}
          <div className="navbar__center-nav">
            <Link
              to="/"
              className={`navbar__pill-link ${location.pathname === "/" ? "active" : ""}`}
            >
              <HomeIcon size={15} />
              <span>Feed</span>
            </Link>

            <Link
              to="/map"
              className={`navbar__pill-link ${location.pathname === "/map" ? "active" : ""}`}
            >
              <MapPinIcon size={15} />
              <span>Crisis map</span>
            </Link>

            <Link
              to="/ngos"
              className={`navbar__pill-link ${location.pathname === "/ngos" || location.pathname === "/ngo" ? "active" : ""}`}
            >
              <UsersIcon size={15} />
              <span>NGO network</span>
            </Link>

            {(role === "moderator" || role === "student_moderator" || role === "senior_moderator" || role === "admin") && (
              <Link
                to="/moderator"
                className={`navbar__pill-link ${location.pathname.startsWith("/moderator") ? "active" : ""}`}
              >
                <ShieldIcon size={15} />
                <span>Moderation</span>
              </Link>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="navbar__right">
            {/* Primary Action Button */}
            <Link
              to={user ? "/report/new" : "/login"}
              className="navbar__report-btn"
            >
              <PlusIcon size={16} />
              <span>Report incident</span>
            </Link>

            {/* Notification Bell */}
            <button className="navbar__icon-btn" title="Notifications" aria-label="Notifications">
              <BellIcon size={17} />
              <span className="navbar__bell-badge" />
            </button>

            {/* Theme Toggle */}
            <button
              className="navbar__icon-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
            </button>

            {/* Auth Buttons / Profile Menu */}
            {!user ? (
              <Link to="/login" className="navbar__signin-btn">
                Sign In
              </Link>
            ) : (
              <div className="navbar__menu-container" ref={menuRef}>
                <button
                  className={`navbar__avatar-btn ${menuOpen ? "active" : ""}`}
                  onClick={() => setMenuOpen((p) => !p)}
                  title="Account menu"
                  aria-expanded={menuOpen}
                >
                  <span className="navbar__avatar-initials">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </button>

                {menuOpen && (
                  <div className="navbar__dropdown" role="menu">
                    <div className="navbar__dropdown-user">
                      <span className="navbar__avatar-initials navbar__avatar-initials--lg">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="navbar__dropdown-name">{user.name}</div>
                        <div className="navbar__dropdown-role">{user.role}</div>
                      </div>
                    </div>
                    <div className="navbar__dropdown-divider" />

                    <Link to="/" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                      <HomeIcon size={14} /> Feed
                    </Link>
                    <Link to="/map" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                      <MapPinIcon size={14} /> Crisis Map
                    </Link>
                    <Link to="/report/new" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                      <AlertTriangleIcon size={14} /> Report Incident
                    </Link>

                    {(role === "ngo" || role === "admin") && (
                      <Link to="/ngo" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                        <UsersIcon size={14} /> NGO Dashboard
                      </Link>
                    )}

                    {(role === "moderator" || role === "student_moderator" || role === "senior_moderator" || role === "admin") && (
                      <>
                        <Link to="/moderator" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                          <ShieldIcon size={14} /> Moderation Dashboard
                        </Link>
                        <Link to="/moderator/wallet" className="navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                          💳 Moderator Wallet
                        </Link>
                      </>
                    )}

                    <div className="navbar__dropdown-divider" />

                    <button
                      className="navbar__dropdown-item navbar__dropdown-item--danger"
                      onClick={() => { logout(); setMenuOpen(false); navigate("/"); }}
                    >
                      <LogOutIcon size={14} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Sub-Header Live Strip from Figma Design */}
      <div className="navbar__live-strip">
        <span className="live-pulse-dot" />
        <span className="navbar__live-strip-text">
          LIVE COMMUNITY RESPONSE NETWORK &nbsp;·&nbsp; {activeReportCount} ACTIVE REPORTS
        </span>
      </div>
    </header>
  );
}
