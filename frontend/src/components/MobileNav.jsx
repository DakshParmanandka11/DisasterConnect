import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HomeIcon, MapPinIcon, AlertTriangleIcon, MessageIcon,
         UsersIcon, ClipboardIcon, ShieldIcon, KeyIcon } from "./Icons";
import "./MobileNav.css";

export default function MobileNav({ onOpenSms }) {
  const { user } = useAuth();
  const location = useLocation();
  const p = location.pathname;
  const role = user?.role || null;

  function renderFifthTab() {
    if (!user) {
      return (
        <Link to="/login" className={`mobile-nav__item ${p === "/login" ? "active" : ""}`}>
          <KeyIcon size={18} className="mobile-nav__icon-svg" />
          <span className="mobile-nav__label">Log in</span>
        </Link>
      );
    }
    if (role === "ngo" || role === "admin") {
      return (
        <Link to="/ngo" className={`mobile-nav__item ${p === "/ngo" ? "active" : ""}`}>
          <ClipboardIcon size={18} className="mobile-nav__icon-svg" />
          <span className="mobile-nav__label">Dashboard</span>
        </Link>
      );
    }
    if (role === "moderator") {
      return (
        <Link to="/moderator" className={`mobile-nav__item ${p === "/moderator" ? "active" : ""}`}>
          <ShieldIcon size={18} className="mobile-nav__icon-svg" />
          <span className="mobile-nav__label">Moderate</span>
        </Link>
      );
    }
    return (
      <Link to="/ngos" className={`mobile-nav__item ${p === "/ngos" ? "active" : ""}`}>
        <UsersIcon size={18} className="mobile-nav__icon-svg" />
        <span className="mobile-nav__label">NGOs</span>
      </Link>
    );
  }

  const handleSmsClick = (e) => {
    e.preventDefault();
    if (typeof onOpenSms === "function") {
      onOpenSms();
    }
  };

  return (
    <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
      <Link to="/" className={`mobile-nav__item ${p === "/" ? "active" : ""}`}>
        <HomeIcon size={18} className="mobile-nav__icon-svg" />
        <span className="mobile-nav__label">Home</span>
      </Link>

      <Link to="/map" className={`mobile-nav__item ${p === "/map" ? "active" : ""}`}>
        <MapPinIcon size={18} className="mobile-nav__icon-svg" />
        <span className="mobile-nav__label">Map</span>
      </Link>

      <Link to={user ? "/report/new" : "/login"} className="mobile-nav__item mobile-nav__item--report">
        <div className="mobile-nav__report-fab">
          <AlertTriangleIcon size={18} />
        </div>
        <span className="mobile-nav__label mobile-nav__label--report">Report</span>
      </Link>

      <button type="button" className="mobile-nav__item" onClick={handleSmsClick}>
        <MessageIcon size={18} className="mobile-nav__icon-svg" />
        <span className="mobile-nav__label">SMS SOS</span>
      </button>

      {renderFifthTab()}
    </nav>
  );
}
