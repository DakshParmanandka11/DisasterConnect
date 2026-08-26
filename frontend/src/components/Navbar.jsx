import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HomeIcon, MapPinIcon, AlertTriangleIcon, ShieldIcon, UsersIcon,
  ClipboardIcon, SunIcon, MoonIcon, LogOutIcon, MenuIcon, SearchIcon
} from "./Icons";
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
    <header className="navbar">
      <div className="container navbar__inner">
        <div className="navbar__left">
          <button
            className="navbar__hamburger"
            onClick={onToggleTaskbar}
            title="Toggle filters"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>

          <Link to="/" className="navbar__brand">
            <span className="navbar__brand-mark" aria-hidden="true" />
            DisasterConnect
          </Link>
        </div>

        <div className="navbar__search">
          <SearchIcon className="navbar__search-icon" size={14} />
          <input placeholder="Search incidents…" aria-label="Search incidents" />
        </div>

        <nav className="navbar__links" role="navigation" aria-label="Main navigation">
          <Link to="/" className={`navbar__nav-item ${location.pathname === "/" ? "active" : ""}`}>
            <HomeIcon size={14} />
            Feed
          </Link>

          <Link to="/map" className={`navbar__nav-item ${location.pathname === "/map" ? "active" : ""}`}>
            <MapPinIcon size={14} />
            Map
          </Link>

          {user && (
            <Link
              to="/report/new"
              className={`navbar__nav-item navbar__nav-item--report ${location.pathname === "/report/new" ? "active" : ""}`}
            >
              <AlertTriangleIcon size={14} />
              Report
            </Link>
          )}

          {(role === "ngo" || role === "admin") && (
            <>
              <Link to="/ngos" className={`navbar__nav-item ${location.pathname === "/ngos" ? "active" : ""}`}>
                <UsersIcon size={14} />
                NGOs
              </Link>
              <Link to="/ngo" className={`navbar__nav-item ${location.pathname === "/ngo" ? "active" : ""}`}>
                <ClipboardIcon size={14} />
                Dashboard
              </Link>
            </>
          )}

          {(role === "moderator" || role === "admin") && (
            <Link to="/moderator" className={`navbar__nav-item ${location.pathname === "/moderator" ? "active" : ""}`}>
              <ShieldIcon size={14} />
              Moderation
            </Link>
          )}

          {/* Theme Toggle Button visible in main navbar header */}
          <button
            className="navbar__theme-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle dark/light mode"
          >
            {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            <span className="navbar__theme-label">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>

          {!user && (
            <>
              <Link to="/login" className={`navbar__nav-item ${location.pathname === "/login" ? "active" : ""}`}>
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}

          {user && (
            <div className="navbar__menu-container" ref={menuRef}>
              <button
                className={`navbar__avatar-btn ${menuOpen ? "active" : ""}`}
                onClick={() => setMenuOpen((p) => !p)}
                title="Account options"
                aria-expanded={menuOpen}
                aria-haspopup="true"
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

                  {/* Mobile-only nav */}
                  <Link to="/" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                    <HomeIcon size={14} /> Feed
                  </Link>
                  <Link to="/map" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                    <MapPinIcon size={14} /> Map
                  </Link>
                  <Link to="/report/new" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                    <AlertTriangleIcon size={14} /> Report Incident
                  </Link>

                  {(role === "ngo" || role === "admin") && (
                    <>
                      <Link to="/ngos" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                        <UsersIcon size={14} /> NGO Network
                      </Link>
                      <Link to="/ngo" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                        <ClipboardIcon size={14} /> NGO Dashboard
                      </Link>
                    </>
                  )}

                  {(role === "moderator" || role === "admin") && (
                    <Link to="/moderator" className="navbar__dropdown-item navbar__dropdown-item--mobile-only" onClick={() => setMenuOpen(false)}>
                      <ShieldIcon size={14} /> Moderation
                    </Link>
                  )}

                  <div className="navbar__dropdown-divider" />

                  <button className="navbar__dropdown-item" onClick={toggleTheme}>
                    {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                    {theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
                  </button>

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
        </nav>
      </div>
    </header>
  );
}
