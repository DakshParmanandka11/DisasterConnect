import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SignalMeter from "./SignalMeter";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import "./ReportRow.css";

const STATUS_LABEL = {
  pending: "Pending Quorum",
  flagged: "Verified / High-Priority",
  under_review: "Under NGO Review",
  resolved: "Resolved",
};

const CATEGORY_LABEL = {
  flood: "c/flooding",
  fire: "c/wildfires",
  earthquake: "c/earthquake",
  accident: "c/accidents",
  building_collapse: "c/structural-collapse",
  gas_leak: "c/gas-hazard",
  other: "c/other-calamities",
  "": "c/all-incidents",
};

function formatMediaUrl(filePath) {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:") || filePath.startsWith("blob:")) {
    return filePath;
  }
  return filePath.startsWith("/") ? filePath : `/${filePath}`;
}

export default function ReportRow({ report: initialReport, config }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(initialReport);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  const hasMedia = report.media && report.media.length > 0;
  const timeAgo = formatTimeAgo(report.created_at);

  function handleCardClick(e) {
    if (e.target.closest("button") || e.target.closest("a")) return;
    navigate(`/report/${report.id}`);
  }

  async function handleVote(e, voteType) {
    e.stopPropagation();
    if (!user) {
      alert("Please log in to vote on disaster reports.");
      return;
    }
    if (voting) return;

    setVoting(true);
    let lat = report.lat;
    let lng = report.lng;

    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500 });
        }).catch(() => null);
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }
    } catch (err) {
      // fallback to report lat/lng if geolocation fails
    }

    try {
      const res = await api.vote(report.id, { vote_type: voteType, lat, lng });
      if (res && res.report) {
        setReport(res.report);
      }
    } catch (err) {
      alert(err.message || "Failed to vote.");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="rp-card" onClick={handleCardClick}>

      {/* ── Vote pillar (left side) ── */}
      <div className="rp-vote">
        <button
          className="rp-vote__btn rp-vote__btn--up"
          title="Upvote — must be within 10 km"
          disabled={voting}
          onClick={(e) => handleVote(e, "up")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1L11.196 10H0.804L6 1Z"/>
          </svg>
        </button>
        <span className="rp-vote__score">{report.upvotes}</span>
        <button
          className="rp-vote__btn rp-vote__btn--down"
          title="Downvote — must be within 10 km"
          disabled={voting}
          onClick={(e) => handleVote(e, "down")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 11L0.804 2H11.196L6 11Z"/>
          </svg>
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="rp-body">

        {/* Meta row: channel • author • time • location • status */}
        <div className="rp-meta">
          <span className="rp-meta__channel">
            {CATEGORY_LABEL[report.category] || `c/${report.category}`}
          </span>
          <span className="rp-meta__dot">•</span>
          <span>Posted by <strong>{report.author?.name || "citizen"}</strong></span>
          <span className="rp-meta__dot">•</span>
          <span>{timeAgo}</span>
          <span className="rp-meta__dot">•</span>
          <span className="rp-meta__geo">📍 {report.lat.toFixed(3)}, {report.lng.toFixed(3)}</span>
          {report.confirmations > 1 && (
            <span className="rp-meta__badge rp-meta__badge--confirm">
              {report.confirmations} reports
            </span>
          )}
          <span className={`status-badge status-${report.status}`}>
            {STATUS_LABEL[report.status]}
          </span>
        </div>

        {/* Title */}
        <h3 className="rp-title">
          <Link to={`/report/${report.id}`}>{report.title}</Link>
        </h3>

        {/* Description (clamped to 2 lines) */}
        {report.description && (
          <p className="rp-desc">{report.description}</p>
        )}

        {/* ── PHOTO — full width like Reddit image posts ── */}
        {hasMedia && (() => {
          const items = report.media.slice(0, 4);
          const count = items.length;
          const extra = report.media.length - 4;

          if (count === 1) {
            const m = items[0];
            const src = formatMediaUrl(m.file_path);
            return (
              <div className="rp-photo rp-photo--single">
                {m.file_type === "video"
                  ? <video src={src} muted playsInline controls />
                  : <img src={src} alt={report.title} loading="lazy" />
                }
              </div>
            );
          }

          return (
            <div className={`rp-photo rp-photo--grid rp-photo--grid-${Math.min(count, 4)}`}>
              {items.map((m, idx) => {
                const src = formatMediaUrl(m.file_path);
                return (
                  <div key={m.id || idx} className="rp-photo__cell">
                    {m.file_type === "video"
                      ? <video src={src} muted playsInline />
                      : <img src={src} alt={`photo ${idx + 1}`} loading="lazy" />
                    }
                    {/* "+N more" overlay on last slot */}
                    {idx === 3 && extra > 0 && (
                      <div className="rp-photo__more">+{extra}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Verification signal meter */}
        <div className="rp-signal">
          <SignalMeter
            pct={report.upvotePct}
            totalVotes={report.totalVotes}
            threshold={config?.verification_threshold_pct ?? 40}
            quorum={config?.min_vote_quorum ?? 10}
            size="sm"
          />
        </div>

        {/* Action footer */}
        <div className="rp-footer">
          <div className="rp-footer__actions">
            <Link to={`/report/${report.id}`} className="rp-footer__btn">
              💬 {report.totalVotes} votes
            </Link>
            <button
              className="rp-footer__btn"
              onClick={(e) => {
                e.stopPropagation();
                const url = window.location.origin + `/report/${report.id}`;
                if (navigator.share) {
                  navigator.share({ title: report.title, text: `🚨 ${report.title}`, url }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText?.(url);
                  alert("Link copied!");
                }
              }}
            >
              📲 Share
            </button>
          </div>
          <span className="rp-footer__radius">📍 10 km radius</span>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(isoString) {
  if (!isoString) return "just now";
  const date = new Date(isoString.endsWith("Z") ? isoString : isoString + "Z");
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
