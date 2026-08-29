import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useGeolocation } from "../hooks/useGeolocation";
import { LayersIcon } from "../components/Icons";
import "./NGONetwork.css";

export default function NGONetwork() {
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNgo, setSelectedNgo] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const geo = useGeolocation();

  useEffect(() => { geo.request().catch(() => {}); }, []);
  useEffect(() => { loadNgos(); }, [geo.coords]);

  async function loadNgos() {
    setLoading(true);
    try {
      const data = await api.getPublicNgos(geo.coords?.lat, geo.coords?.lng);
      setNgos(data.ngos || []);
    } catch (err) {
      setError(err.message || "Failed to load NGO network");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyUpi(upiId) {
    navigator.clipboard?.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 3000);
  }

  return (
    <div className="ngo-network-page container" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <div className="ngo-header">
        <div className="ngo-header__title-row">
          <div>
            <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Relief NGO Network</h1>
            <p className="ngo-header__sub">
              Verified disaster response organisations connected to DisasterConnect.
              Donate directly via UPI — zero gateway fees.
            </p>
          </div>
        </div>
        <div className="ngo-stats-bar">
          <div className="ngo-stat">
            <span className="ngo-stat__value">{ngos.length}</span>
            <span className="ngo-stat__label">Verified partners</span>
          </div>
          <div className="ngo-stat">
            <span className="ngo-stat__value">Direct</span>
            <span className="ngo-stat__label">UPI transfers</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="ngo-loading">
          <div className="spinner" />
          <p>Loading organisations…</p>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {!loading && !error && (
        <div className="ngo-grid">
          {ngos.map((ngo) => (
            <div key={ngo.id} className="ngo-card">
              <div className="ngo-card__top">
                <div className="ngo-card__avatar">
                  {ngo.org_name?.charAt(0).toUpperCase() || "N"}
                </div>
                <div>
                  <div className="ngo-card__title">{ngo.org_name}</div>
                  <div className="ngo-card__verified-badge">
                    Verified relief partner
                  </div>
                </div>
              </div>

              <div className="ngo-card__body">
                <div className="ngo-field">
                  <span className="ngo-field__label">Focus areas</span>
                  <span className="ngo-field__val">{ngo.focus_areas || "Emergency food, medical aid, rescue"}</span>
                </div>
                <div className="ngo-field">
                  <span className="ngo-field__label">Coverage</span>
                  <span className="ngo-field__val">{ngo.service_radius_km} km radius</span>
                </div>
                {ngo.distanceKm != null && (
                  <div className="ngo-field">
                    <span className="ngo-field__label">Distance</span>
                    <span className="ngo-field__val highlight">{ngo.distanceKm} km from you</span>
                  </div>
                )}
                <div className="ngo-field">
                  <span className="ngo-field__label">Status</span>
                  <span className="ngo-field__val">
                    {ngo.activeIncidentCount > 0 ? (
                      <span className="badge-alert">{ngo.activeIncidentCount} active task{ngo.activeIncidentCount > 1 ? "s" : ""}</span>
                    ) : (
                      <span className="badge-idle">On standby</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="ngo-card__footer">
                <button className="btn-donate-qr" onClick={() => setSelectedNgo(ngo)}>
                  Donate via UPI
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Donation QR modal */}
      {selectedNgo && (
        <div className="ngo-modal-overlay" onClick={() => setSelectedNgo(null)}>
          <div className="ngo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ngo-modal__header">
              <h3>Relief Donation — {selectedNgo.org_name}</h3>
              <button className="ngo-modal__close" onClick={() => setSelectedNgo(null)} aria-label="Close">✕</button>
            </div>

            <div className="ngo-modal__body">
              <p className="ngo-modal__desc">
                Scan the QR code with any UPI app (Google Pay, PhonePe, Paytm, BHIM) to send funds directly to ground responders. Zero gateway fees.
              </p>

              <div className="ngo-qr-container">
                <img src={selectedNgo.qrUrl} alt={`UPI QR code for ${selectedNgo.org_name}`} className="ngo-qr-image" />
                <div className="ngo-qr-badge">Scan with GPay / PhonePe / Paytm / BHIM</div>
              </div>

              <div className="ngo-upi-box">
                <div className="ngo-upi-label">Verified UPI ID</div>
                <div className="ngo-upi-row">
                  <code className="ngo-upi-id">{selectedNgo.upi_id || "relief-ngo@upi"}</code>
                  <button className="ngo-copy-btn" onClick={() => handleCopyUpi(selectedNgo.upi_id || "relief-ngo@upi")}>
                    {copiedUpi ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="ngo-contact-info">
                {selectedNgo.contact_phone && <div><strong>Phone:</strong> {selectedNgo.contact_phone}</div>}
                <div><strong>Email:</strong> {selectedNgo.contact_email || selectedNgo.user_email}</div>
                <div><strong>Coverage:</strong> {selectedNgo.service_radius_km} km radius</div>
              </div>

              <a href={selectedNgo.upiUri} className="btn-launch-upi">
                Open UPI app to pay
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
