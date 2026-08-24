import { useState, useEffect } from "react";
import "./PwaInstallBanner.css";

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      return;
    }

    // Don't show if user already dismissed
    if (sessionStorage.getItem("pwa-install-dismissed")) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after 3 seconds on mobile
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowBanner(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  if (!showBanner || installed) return null;

  return (
    <div className="pwa-banner">
      <div className="pwa-banner__icon">📲</div>
      <div className="pwa-banner__content">
        <div className="pwa-banner__title">Install DisasterConnect</div>
        <div className="pwa-banner__sub">
          Save to Home Screen — works 100% offline with Emergency SMS Rescue even without internet
        </div>
      </div>
      <div className="pwa-banner__actions">
        <button className="pwa-banner__install-btn" onClick={handleInstall}>
          Install
        </button>
        <button className="pwa-banner__dismiss-btn" onClick={handleDismiss}>
          ✕
        </button>
      </div>
    </div>
  );
}
