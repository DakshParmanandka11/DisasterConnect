import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useGeolocation } from "../hooks/useGeolocation";
import { savePendingReport } from "../util/offlineStore";
import "./NewReport.css";

const CATEGORIES = ["flood", "fire", "earthquake", "tsunami", "landslide", "building_collapse", "other"];
const SEVERITIES = ["moderate", "high", "critical"];

const CATEGORY_LABELS = {
  flood: "Flood", fire: "Fire", earthquake: "Earthquake", tsunami: "Tsunami",
  landslide: "Landslide", building_collapse: "Collapse", other: "Other",
};

export default function NewReport() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("flood");
  const [severity, setSeverity] = useState("moderate");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);
  const fileInputRef = useRef(null);
  const geo = useGeolocation();
  const navigate = useNavigate();

  useEffect(() => {
    geo.request().catch(() => {});
  }, []);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleCameraCapture(e) {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    const newFiles = [...files, ...incoming].slice(0, 5);
    setFiles(newFiles);

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
      setError("Device GPS location is required. Please enable location access.");
      return;
    }
    if (files.length === 0) {
      setError("At least one camera photo is required to verify the incident.");
      return;
    }

    setBusy(true);

    if (!navigator.onLine) {
      try {
        await savePendingReport({
          title, description, category, severity,
          lat: geo.coords.lat, lng: geo.coords.lng, files,
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
    <div className="container" style={{ maxWidth: 560, paddingTop: 24, paddingBottom: 60 }}>
      <div className="nr-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Report an Incident</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: 13 }}>
            All reports are reviewed by moderators for verification before being published on the public feed.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Camera Capture — only from camera, not storage */}
        <div className="nr-camera-section">
          <div className="nr-camera-label">
            <span>Incident Photos</span>
            <span className="nr-camera-note">📷 Camera only · up to 5· no file uploads
            </span>
          </div>

          <div className="nr-photo-grid">
            {previews.map((url, idx) => (
              <div key={idx} className="nr-photo-thumb">
                <img src={url} alt={`capture-${idx}`} />
                <button
                  type="button"
                  className="nr-photo-remove"
                  onClick={() => removePhoto(idx)}
                  title="Remove"
                >
                  ✕
                </button>
                <div className="nr-photo-num">{idx + 1}</div>
              </div>
            ))}

            {files.length < 5 && (
              <button
                type="button"
                className="nr-add-photo-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="nr-add-photo-icon">+</span>
                <span>{files.length === 0 ? "Take Photo" : "Add More"}</span>
              </button>
            )}
          </div>

          {/*
            Camera-only input:
            - accept="image/*" restricts to images
            - capture="environment" forces camera (back/env camera preferred)
            - On a laptop/desktop this opens the webcam directly
            - Does NOT allow picking from gallery or file storage
            - The user must physically take a photo with their device camera
          */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleCameraCapture}
          />

          {files.length === 0 && (
            <p className="nr-camera-hint">
              Photos are timestamped and geotagged at your current location.
              <br />
              <strong>Camera access required</strong> — only live camera captures accepted.
              On a laptop or desktop, your webcam will open automatically.
              No uploads from storage or gallery are permitted.
            </p>
          )}
          {files.length > 0 && (
            <p className="nr-camera-count">
              {files.length} photo{files.length > 1 ? "s" : ""} captured ·{" "}
              {5 - files.length > 0 ? `${5 - files.length} more allowed` : "maximum reached"}
            </p>
          )}
        </div>

        {/* GPS Geotag */}
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
            <label style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
              GPS Location
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => geo.request()} style={{ fontSize: 11 }}>
              Refresh
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px 0", lineHeight: 1.4 }}>
            Location is captured from your device GPS. Manual editing is disabled.
          </p>

          {geo.loading ? (
            <div style={{ fontSize: 13, color: "var(--blue)", fontWeight: 600 }}>
              Acquiring location...
            </div>
          ) : geo.coords ? (
            <div style={{ background: "var(--green-bg)", color: "var(--green)", padding: "6px 10px", borderRadius: "var(--radius-xs)", fontSize: 12, fontWeight: 600 }}>
              GPS location locked
            </div>
          ) : (
            <div className="error-banner" style={{ margin: 0, fontSize: 12 }}>
              GPS required. Please enable location access.
            </div>
          )}
        </div>

        {/* Incident Details */}
        <div className="field">
          <label>Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the incident"
          />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's happening? How severe is it?"
          />
        </div>

        {/* Category */}
        <div className="field">
          <label>Category</label>
          <div className="nr-category-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`nr-category-tile${category === c ? " active" : ""}`}
                onClick={() => setCategory(c)}
              >
                <span>{CATEGORY_LABELS[c]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="field">
          <label>Severity</label>
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
          <div style={{ background: "var(--green-bg)", color: "var(--green)", padding: 14, borderRadius: "var(--radius-sm)", marginTop: 16, border: "1px solid var(--green)" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Saved Offline</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Your report has been queued and will auto-sync when connectivity is restored.
            </div>
          </div>
        )}

        <button
          className="btn btn-primary"
          disabled={busy || files.length === 0 || !geo.coords}
          style={{ width: "100%", padding: "12px", fontSize: 14, marginTop: 12 }}
        >
          {busy ? "Submitting..." : `Submit Report${files.length > 0 ? ` (${files.length} photo${files.length > 1 ? "s" : ""})` : ""}`}
        </button>

        {(!geo.coords || files.length === 0) && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            {!geo.coords ? "GPS location required" : "Camera photo required"}
          </p>
        )}
      </form>
    </div>
  );
}
