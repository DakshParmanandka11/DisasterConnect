import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./MobileNav.css";

export default function MobileNav() {
  const { user } = useAuth();
  const location = useLocation();
  const p = location.pathname;

  return (
    <nav className="mobile-nav">
      <Link to="/" className={`mobile-nav__item ${p === "/" ? "active" : ""}`}>
        <span className="mobile-nav__icon">🏠</span>
        <span className="mobile-nav__label">Home</span>
      </Link>

      <Link to="/map" className={`mobile-nav__item ${p === "/map" ? "active" : ""}`}>
        <span className="mobile-nav__icon">🗺️</span>
        <span className="mobile-nav__label">Map</span>
      </Link>

      {/* Centre FAB — Report */}
      <Link to="/report/new" className="mobile-nav__item mobile-nav__item--cam">
        <div className="mobile-nav__cam-fab">📷</div>
        <span className="mobile-nav__label" style={{ color: "var(--alert)", fontWeight: 700 }}>Report</span>
      </Link>

      {user && user.role === "ngo" ? (
        <Link to="/ngo" className={`mobile-nav__item ${p === "/ngo" ? "active" : ""}`}>
          <span className="mobile-nav__icon">🏥</span>
          <span className="mobile-nav__label">NGO</span>
        </Link>
      ) : (
        <Link to={user ? "#" : "/login"} className={`mobile-nav__item ${p === "/login" ? "active" : ""}`}>
          <span className="mobile-nav__icon">{user ? "👤" : "🔑"}</span>
          <span className="mobile-nav__label">{user ? user.name.split(" ")[0] : "Login"}</span>
        </Link>
      )}
    </nav>
  );
}
