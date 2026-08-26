import { useState } from "react";
import { MessageIcon, CopyIcon, CheckIcon, XIcon } from "./Icons";
import "./SmsFallbackModal.css";

export default function SmsFallbackModal({ reportData = {}, onClose }) {
  const [copied, setCopied] = useState(false);

  const catCode = (reportData.category || "OTHER").toUpperCase();
  const sevCode = (reportData.severity || "MODERATE").toUpperCase();
  const lat = reportData.lat ? Number(reportData.lat).toFixed(4) : "0.0000";
  const lng = reportData.lng ? Number(reportData.lng).toFixed(4) : "0.0000";
  const title = (reportData.title || "").replace(/\|/g, "-").slice(0, 30);
  const time = Math.floor(Date.now() / 1000);

  const smsString = `ALERT|${catCode}|${sevCode}|${lat},${lng}|${time}|${title}`;
  const targetNumber = "911100200";
  const smsUri = `sms:${targetNumber}?body=${encodeURIComponent(smsString)}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(smsString);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="sms-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sms-modal__header">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MessageIcon size={16} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>2G / SMS Fallback Dispatch</h3>
          </div>
          <button className="sms-modal__close" onClick={onClose} title="Close" aria-label="Close modal">
            <XIcon size={16} />
          </button>
        </div>

        <p className="sms-intro">
          If 3G/4G/5G mobile data is completely unavailable during an emergency, transmit this compressed distress payload over basic 2G SMS bands to emergency responders:
        </p>

        <div className="sms-box">
          <code>{smsString}</code>
        </div>

        <div className="sms-actions">
          <a href={smsUri} className="btn btn-primary btn-sm" style={{ flex: 1, textDecoration: "none" }}>
            Launch SMS App
          </a>
          <button className="btn btn-outline btn-sm" onClick={handleCopy} style={{ gap: 4 }}>
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied ? "Copied" : "Copy string"}
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--amber)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Emergency Situation Presets:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|FLOOD|CRITICAL|${lat},${lng}|TRAPPED IN FLOOD`)}`}
              className="sms-preset-btn"
            >
              Flood / Waterlogging
            </a>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|FIRE|CRITICAL|${lat},${lng}|FIRE RESCUE NEEDED`)}`}
              className="sms-preset-btn"
            >
              Fire Hazard
            </a>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|EARTHQUAKE|CRITICAL|${lat},${lng}|QUAKE DEBRIS TRAPPED`)}`}
              className="sms-preset-btn"
            >
              Earthquake
            </a>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|BUILDING_COLLAPSE|CRITICAL|${lat},${lng}|STRUCTURAL COLLAPSE`)}`}
              className="sms-preset-btn"
            >
              Structural Collapse
            </a>
          </div>
        </div>

        <div className="sms-bot-info">
          <strong>SMS Bot (Shortcode 112):</strong>
          <p style={{ margin: "3px 0 0 0" }}>
            Text <code>SOS</code> or <code>HELP</code> to shortcode <strong>112</strong> for automated triage.
          </p>
        </div>
      </div>
    </div>
  );
}
