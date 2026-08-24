import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function ClickCatcher({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ lat, lng }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

export default function MapPicker({ lat, lng, onPick, height = 260, radiusKm, editable = true }) {
  const center = lat != null && lng != null ? [lat, lng] : [28.6139, 77.209]; // default New Delhi

  return (
    <div style={{ height, borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--line)" }}>
      <MapContainer center={center} zoom={lat != null ? 13 : 5} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {editable && <ClickCatcher onPick={onPick} />}
        {lat != null && lng != null && (
          <>
            <Marker position={[lat, lng]} />
            {radiusKm && <Circle center={[lat, lng]} radius={radiusKm * 1000} pathOptions={{ color: "#1B4B43", fillOpacity: 0.06 }} />}
          </>
        )}
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}
