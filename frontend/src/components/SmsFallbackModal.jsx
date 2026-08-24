import { useState } from "react";
import "./SmsFallbackModal.css";

export default function SmsFallbackModal({ reportData, onClose }) {
  const [copied, setCopied] = useState(false);

  const catCode = (reportData.category || "OTHER").toUpperCase();
  const sevCode = (reportData.severity || "MODERATE").toUpperCase();
  const lat = reportData.lat ? Number(reportData.lat).toFixed(4) : "0.0000";
  const lng = reportData.lng ? Number(reportData.lng).toFixed(4) : "0.0000";
  const title = (reportData.title || "").replace(/\|/g, "-").slice(0, 30);
  const time = Math.floor(Date.now() / 1000);

  // Formatted compressed SMS string
  const smsString = `ALERT|${catCode}|${sevCode}|${lat},${lng}|${time}|${title}`;
  const targetNumber = "911100200"; // Centralized emergency broadcast / gateway
  const smsUri = `sms:${targetNumber}?body=${encodeURIComponent(smsString)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(smsString);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="sms-modal-overlay" onClick={onClose}>
      <div className="sms-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>📲 2G / SMS Fallback Dispatch</h3>
        <p className="sms-intro">
          If 3G/4G/5G data networks are completely down, you can transmit this compressed distress payload over basic 2G SMS bands to emergency responders:
        </p>

        <div className="sms-box">
          <code>{smsString}</code>
        </div>

        <div className="sms-actions">
          <a href={smsUri} className="sms-launch-btn">
            💬 One-Tap Launch SMS App
          </a>
          <button className="sms-copy-btn" onClick={handleCopy}>
            {copied ? "✓ Copied String" : "📋 Copy String"}
          </button>
        </div>

        {/* One-Tap Situation Presets for Panic Situations */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>
            ⚡ One-Tap Emergency Presets (Zero Typing):
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|FLOOD|CRITICAL|${lat},${lng}|TRAPPED ON ROOF`)}`}
              className="sms-preset-btn"
              style={{ background: "rgba(14, 165, 233, 0.2)", border: "1px solid #0ea5e9", color: "#38bdf8", padding: "8px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600, textAlign: "center" }}
            >
              🌊 Flood Trapped
            </a>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|FIRE|CRITICAL|${lat},${lng}|FIRE RESCUE NEEDED`)}`}
              className="sms-preset-btn"
              style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", padding: "8px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600, textAlign: "center" }}
            >
              🔥 Fire Hazard
            </a>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|MEDICAL|CRITICAL|${lat},${lng}|INJURED AMBULANCE NEEDED`)}`}
              className="sms-preset-btn"
              style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#6ee7b7", padding: "8px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600, textAlign: "center" }}
            >
              🚑 Medical Emergency
            </a>
            <a
              href={`sms:911100200?body=${encodeURIComponent(`SOS|COLLAPSE|CRITICAL|${lat},${lng}|DEBRIS TRAPPED`)}`}
              className="sms-preset-btn"
              style={{ background: "rgba(245, 158, 11, 0.2)", border: "1px solid #f59e0b", color: "#fde047", padding: "8px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600, textAlign: "center" }}
            >
              🏚️ Building Collapse
            </a>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed #475569", fontSize: 12, color: "#94a3b8" }}>
          <strong style={{ color: "#38bdf8" }}>📱 Easiest Method for Non-Technical Users (SMS Bot):</strong>
          <p style={{ margin: "4px 0 0 0", lineHeight: 1.4 }}>
            Simply text the single word <strong style={{ color: "#ef4444", background: "#334155", padding: "1px 6px", borderRadius: 3 }}>SOS</strong> or <strong style={{ color: "#ef4444", background: "#334155", padding: "1px 6px", borderRadius: 3 }}>HELP</strong> to shortcode <strong className="mono" style={{ color: "#38bdf8" }}>112</strong>.
          </p>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4, fontStyle: "italic" }}>
            The emergency bot will reply automatically with a 1-digit choice menu (1 for Flood, 2 for Fire) and telco towers auto-triangulate your location!
          </div>
        </div>

        <button className="sms-close-btn" onClick={onClose} style={{ marginTop: 16 }}>
          Close
        </button>
      </div>
    </div>
  );
}
