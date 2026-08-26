import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import { api } from "../api/client";
import { socket } from "../api/socket";

const STATUS_COLOR = {
  pending: "#C8890A",
  flagged: "#E14E1D",
  under_review: "#1B4B43",
  resolved: "#8A948C",
};

const STATUS_LABEL = {
  pending: "Pending",
  flagged: "Flagged / High-Priority",
  under_review: "Under NGO Review",
  resolved: "Resolved",
};

export default function CrisisMap() {
  const [reports, setReports] = useState([]);
  const [pulseIds, setPulseIds] = useState(new Set());

  useEffect(() => {
    function fetchReports() {
      api.listReports()
        .then((data) => setReports(data && Array.isArray(data.reports) ? data.reports : []))
        .catch(() => {});
    }

    fetchReports();
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);

  const center =
    reports.length > 0
      ? [reports[0].lat, reports[0].lng]
      : [28.6139, 77.209];

  return (
    <div>
      <div className="container" style={{ paddingTop: 24, paddingBottom: 12 }}>
        <h1>Live Crisis Map</h1>
        <p style={{ color: "var(--muted)", marginTop: -6 }}>
          Every active report, color-coded by verification status. Updates in real time as votes come in.
        </p>
        <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 8 }}>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLOR[k], display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ height: "calc(100vh - 200px)", minHeight: 420 }}>
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {reports.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={pulseIds.has(r.id) ? 16 : 10}
              pathOptions={{
                color: STATUS_COLOR[r.status],
                fillColor: STATUS_COLOR[r.status],
                fillOpacity: 0.55,
                weight: pulseIds.has(r.id) ? 3 : 1.5,
              }}
            >
              <Popup>
                <div style={{ fontFamily: "var(--font-body)", minWidth: 180 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                    {r.category} · {STATUS_LABEL[r.status]}
                    {r.confirmations > 1 && ` · ${r.confirmations} confirming reports`}
                  </div>
                  <Link to={`/report/${r.id}`}>View report →</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
