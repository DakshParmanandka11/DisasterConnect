import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useGeolocation } from "../hooks/useGeolocation";
import { savePendingReport } from "../util/offlineStore";
import SmsFallbackModal from "../components/SmsFallbackModal";
import "./NewReport.css";

const CATEGORIES = ["flood", "fire", "earthquake", "accident", "building_collapse", "gas_leak", "other"];
const SEVERITIES = ["low", "moderate", "high", "critical"];

const CATEGORY_ICONS = {
  flood: "🌊", fire: "🔥", earthquake: "🌋", accident: "💥",
  building_collapse: "🏚️", gas_leak: "⚠️", other: "📍",
};

export default function NewReport() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("flood");
  const [severity, setSeverity] = useState("moderate");
  const [files, setFiles] = useState([]);        // File objects
  const [previews, setPreviews] = useState([]);  // blob: URLs for preview
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const fileInputRef = useRef(null);
  const geo = useGeolocation();
  const navigate = useNavigate();

  // Auto-capture location via device GPS hardware on mount
  useEffect(() => {
    geo.request().catch(() => {});
  }, []);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleCameraCapture(e) {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    const newFiles = [...files, ...incoming].slice(0, 5);
    setFiles(newFiles);

    // Revoke old previews and generate new ones
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(newFiles.map((f) => URL.createObjectURL(f)));

    e.target.value = "";
  }

  function removePhoto(idx) {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!geo.coords) {
      setError("Device GPS location is required. Please turn on location access on your phone.");
      return;
    }
    if (files.length === 0) {
      setError("At least one photo from your camera is required to verify the incident.");
      return;
    }

    setBusy(true);

    if (!navigator.onLine) {
      try {
        await savePendingReport({
          title,
          description,
          category,
          severity,
          lat: geo.coords.lat,
          lng: geo.coords.lng,
          files,
        });
        setOfflineNotice(true);
      } catch (err) {
        setError("Failed to save report offline: " + err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", description);
      fd.append("category", category);
      fd.append("severity", severity);
      fd.append("lat", geo.coords.lat);
      fd.append("lng", geo.coords.lng);
      files.forEach((f) => fd.append("media", f));

      const data = await api.createReport(fd);
      navigate(`/report/${data.report.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 580, paddingTop: 24, paddingBottom: 60 }}>
      <div className="nr-header">
        <div className="nr-header__icon">🚨</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Report an Incident</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: 13 }}>
            Camera photo + automatic GPS geotag required for authenticity.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      <form onSubmit={handleSubmit}>
        {/* ─── CAMERA CAPTURE (Instagram-style) ─── */}
        <div className="nr-camera-section">
          <div className="nr-camera-label">
            <span className="mono">📸 INCIDENT PHOTOS</span>
            <span className="nr-camera-note">Camera only · up to 5 photos</span>
          </div>

          {/* Photo Grid Preview */}
          <div className="nr-photo-grid">
            {previews.map((url, idx) => (
              <div key={idx} className="nr-photo-thumb">
                <img src={url} alt={`capture-${idx}`} />
                <button
                  type="button"
                  className="nr-photo-remove"
                  onClick={() => removePhoto(idx)}
                  title="Remove photo"
                >
                  ✕
                </button>
                <div className="nr-photo-num">{idx + 1}</div>
              </div>
            ))}

            {/* Add Photo Button */}
            {files.length < 5 && (
              <button
                type="button"
                className="nr-add-photo-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="nr-add-photo-icon">📷</span>
                <span>{files.length === 0 ? "Open Camera" : "Add More"}</span>
              </button>
            )}
          </div>

          {/* Hidden camera-only input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: "none" }}
            onChange={handleCameraCapture}
          />

          {files.length === 0 && (
            <p className="nr-camera-hint">
              📍 Each photo is timestamped and geotagged at your current location.
              Only camera captures are accepted to prevent fake reports.
            </p>
          )}
          {files.length > 0 && (
            <p className="nr-camera-count">
              {files.length} photo{files.length > 1 ? "s" : ""} captured ·{" "}
              {5 - files.length > 0 ? `${5 - files.length} more allowed` : "maximum reached"}
            </p>
          )}
        </div>

        {/* ─── AUTOMATIC GPS GEOTAG ONLY (No manual map input allowed) ─── */}
        <div
          className="field"
          style={{
            background: "var(--bg-card-alt)",
            padding: 14,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
              📡 HARDWARE GPS GEOTAG (GPS ONLY)
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => geo.request()}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              🔄 Refresh GPS
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
            Geotag location is captured directly from your device GPS hardware. Manual location editing or pinning is disabled to ensure anti-tampering verification.
          </p>

          {geo.loading ? (
            <div style={{ fontSize: 13, color: "var(--intel)", fontWeight: 600 }}>
              📡 Acquiring GPS satellite coordinates...
            </div>
          ) : geo.coords ? (
            <div className="tag" style={{ background: "var(--verified-muted)", color: "var(--verified)", padding: "8px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>🔒 GPS Geotag Locked:</span>
              <strong className="mono">{geo.coords.lat.toFixed(5)}, {geo.coords.lng.toFixed(5)}</strong>
            </div>
          ) : (
            <div className="error-banner" style={{ margin: 0, fontSize: 12 }}>
              ⚠️ Device GPS required. Please enable location access on your phone or browser.
            </div>
          )}
        </div>

        {/* ─── INCIDENT DETAILS ─── */}
        <div className="field">
          <label>Incident Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flash flood on MG Road near metro station"
          />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's happening? How severe does it look? Are people trapped?"
          />
        </div>

        {/* ─── CATEGORY TILES ─── */}
        <div className="field">
          <label>Incident Category</label>
          <div className="nr-category-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`nr-category-tile${category === c ? " active" : ""}`}
                onClick={() => setCategory(c)}
              >
                <span className="nr-category-icon">{CATEGORY_ICONS[c]}</span>
                <span>{c.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── SEVERITY ─── */}
        <div className="field">
          <label>Severity Level</label>
          <div className="nr-severity-row">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                className={`nr-severity-btn nr-severity-${s}${severity === s ? " active" : ""}`}
                onClick={() => setSeverity(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {offlineNotice && (
          <div style={{ background: "#065f46", color: "#ecfdf5", padding: 14, borderRadius: 8, marginTop: 16, border: "1px solid #059669" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📱 Saved Offline to Phone Storage!</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Cell data is offline. Your report + photo & geotag have been queued in phone memory and will auto-sync the second connectivity is restored.
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSmsModal(true)}
              style={{ marginTop: 10, width: "100%", fontSize: 13, background: "#047857" }}
            >
              📲 Dispatch via 2G / SMS Fallback
            </button>
          </div>
        )}

        <button
          className="btn btn-primary"
          disabled={busy || files.length === 0 || !geo.coords}
          style={{ width: "100%", padding: "14px", fontSize: 15, marginTop: 12 }}
        >
          {busy ? "Submitting Report…" : `🚨 Submit Incident Report${files.length > 0 ? ` (${files.length} photo${files.length > 1 ? "s" : ""})` : ""}`}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowSmsModal(true)}
          style={{ width: "100%", fontSize: 12, marginTop: 6, color: "var(--text-muted)" }}
        >
          💬 Generate 2G SMS Dispatch Payload
        </button>

        {(!geo.coords || files.length === 0) && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            {!geo.coords ? "GPS location required to submit" : "Camera photo required before submitting"}
          </p>
        )}
      </form>

      {showSmsModal && (
        <SmsFallbackModal
          reportData={{ title, description, category, severity, lat: geo.coords?.lat, lng: geo.coords?.lng }}
          onClose={() => setShowSmsModal(false)}
        />
      )}
    </div>
  );
}
