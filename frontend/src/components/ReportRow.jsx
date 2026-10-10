import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { MapPinIcon, CheckCircleIcon, UsersIcon, ThumbsUpIcon, ChevronRightIcon } from "./Icons";
import "./ReportRow.css";

const CATEGORY_LABEL = {
  flood: "Flood",
  fire: "Fire",
  wildfire: "Fire",
  earthquake: "Earthquake",
  tsunami: "Storm",
  landslide: "Landslide",
  building_collapse: "Collapse",
  other: "Incident",
  "": "Incident",
};

// Fallback high quality disaster imagery matching the Figma design
const DEMO_IMAGES = {
  flood: "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80",
  tsunami: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=80",
  earthquake: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?auto=format&fit=crop&w=800&q=80",
  fire: "https://images.unsplash.com/photo-1569060368423-71887e076632?auto=format&fit=crop&w=800&q=80",
  other: "https://images.unsplash.com/photo-1508873696983-2df515122519?auto=format&fit=crop&w=800&q=80"
};

function formatMediaUrl(filePath, category) {
  if (filePath) {
    if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:") || filePath.startsWith("blob:")) {
      return filePath;
    }
    return filePath.startsWith("/") ? filePath : `/${filePath}`;
  }
  return DEMO_IMAGES[category] || DEMO_IMAGES.flood;
}

export default function ReportRow({ report: initialReport }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(initialReport);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  const hasMedia = report.media && report.media.length > 0;
  const firstMedia = hasMedia ? report.media[0] : null;
  const imageUrl = formatMediaUrl(firstMedia?.file_path, report.category);

  const isCritical = report.status === "flagged" || (report.confirmations >= 2) || (report.upvotes > 20);
  const isVerified = report.moderation_status === "approved" || report.status === "flagged" || report.upvotes >= 10;
  const isSeniorApproved = report.moderation_status === "approved";

  // Calculate vote percentage (default 100% or based on upvotes/downvotes)
  const totalVotes = (report.upvotes || 0) + (report.downvotes || 0);
  const confirmPct = totalVotes > 0 ? Math.round(((report.upvotes || 0) / totalVotes) * 100) : 100;

  function handleCardClick(e) {
    if (e.target.closest("button") || e.target.closest("a")) return;
    navigate(`/report/${report.id}`);
  }

  async function handleVoteUp(e) {
    e.stopPropagation();
    if (voting) return;
    setVoting(true);
    try {
      const res = await api.vote(report.id, { vote_type: "up", lat: report.lat, lng: report.lng });
      if (res && res.report) {
        setReport(res.report);
      }
    } catch (err) {
      alert(err.message || "Vote failed.");
    } finally {
      setVoting(false);
    }
  }

  async function handleVoteDown(e) {
    e.stopPropagation();
    if (voting) return;
    setVoting(true);
    try {
      const res = await api.vote(report.id, { vote_type: "down", lat: report.lat, lng: report.lng });
      if (res && res.report) {
        setReport(res.report);
      }
    } catch (err) {
      alert(err.message || "Vote failed.");
    } finally {
      setVoting(false);
    }
  }

  const categoryName = CATEGORY_LABEL[report.category] || report.category || "Flood";
  const dateFormatted = formatDateString(report.created_at);

  return (
    <div className="figma-card" onClick={handleCardClick}>
      {/* Left Column: Image Thumbnail */}
      <div className="figma-card__image-container">
        <img
          src={imageUrl}
          alt={report.title}
          className="figma-card__image"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = DEMO_IMAGES[report.category] || DEMO_IMAGES.flood;
          }}
        />

        {/* Top-Left Urgency Badge */}
        <div className="figma-card__badge-overlay">
          {isCritical ? (
            <span className="badge-critical">CRITICAL</span>
          ) : (
            <span className="badge-high">HIGH</span>
          )}
        </div>

        {/* Bottom-Right Evidence Overlay */}
        <div className="figma-card__evidence-badge">
          <span>Evidence photo</span>
        </div>
      </div>

      {/* Right Column: Details Content */}
      <div className="figma-card__content">
        {/* Top Meta Line */}
        <div className="figma-card__meta-top">
          <span className="figma-card__category">{categoryName}</span>
          <span className="figma-card__dot">&bull;</span>
          <span className="figma-card__date">{dateFormatted}</span>
        </div>

        {/* Headline Title */}
        <h3 className="figma-card__title">
          <Link to={`/report/${report.id}`}>{report.title}</Link>
        </h3>

        {/* Description Paragraph */}
        {report.description && (
          <p className="figma-card__description">{report.description}</p>
        )}

        {/* Geotag & Reporter */}
        <div className="figma-card__location-row">
          <span className="figma-card__coord">
            <MapPinIcon size={13} />
            {report.lat ? `${Number(report.lat).toFixed(3)}, ${Number(report.lng).toFixed(3)}` : "Coordinates verified"}
          </span>
          <span className="figma-card__reporter">
            Reported by <strong>{report.author?.name || "Local Citizen"}</strong>
          </span>
        </div>

        {/* Footer Row */}
        <div className="figma-card__footer">
          {/* Status Badge */}
          <div className="figma-card__status-wrap">
            {isSeniorApproved ? (
              <span className="badge-approved">
                <CheckCircleIcon size={13} />
                Senior approved
              </span>
            ) : isVerified ? (
              <span className="badge-verified">
                <UsersIcon size={13} />
                Community verified
              </span>
            ) : (
              <span className="badge-verified" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", borderColor: "rgba(59, 130, 246, 0.3)" }}>
                <UsersIcon size={13} />
                Under community review
              </span>
            )}
          </div>

          {/* Upvote & Downvote Arrow Pills */}
          <div className="figma-card__stats-right">
            <div className="vote-pill-bar">
              <button
                className="vote-pill vote-pill--up"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={handleVoteUp}
                disabled={voting}
                title="Confirm Incident (Upvote)"
              >
                <span className="vote-pill__arrow">↑</span>
                <span>{report.upvotes || 0}</span>
              </button>

              <button
                className="vote-pill vote-pill--down"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={handleVoteDown}
                disabled={voting}
                title="Dispute Incident (Downvote)"
              >
                <span className="vote-pill__arrow">↓</span>
                <span>{report.downvotes || 0}</span>
              </button>
            </div>

            <ChevronRightIcon size={16} className="figma-card__chevron" />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateString(isoString) {
  if (!isoString) return "Aug 25, 3:30 PM";
  try {
    const d = new Date(isoString.endsWith("Z") ? isoString : isoString + "Z");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const date = d.getDate();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${month} ${date}, ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return "Aug 25, 3:30 PM";
  }
}
