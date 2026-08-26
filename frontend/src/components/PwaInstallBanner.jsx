import { useState, useEffect } from "react";
import "./PwaInstallBanner.css";

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setShowBanner(false);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setShowBanner(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // If deferredPrompt is not available (e.g. iOS Safari or unsupported browser), show step-by-step guide
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="pwa-banner">
        <div className="pwa-banner__icon">📲</div>
        <div className="pwa-banner__content">
          <div className="pwa-banner__title">Install DisasterConnect App</div>
          <div className="pwa-banner__sub">
            Add to Home Screen for 100% offline access & emergency SMS rescue!
          </div>
        </div>
        <div className="pwa-banner__actions">
          <button className="pwa-banner__install-btn" onClick={handleInstall}>
            Install App
          </button>
          <button className="pwa-banner__dismiss-btn" onClick={handleDismiss} title="Dismiss">
            ✕
          </button>
        </div>
      </div>

      {showGuideModal && (
        <div className="pwa-modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="pwa-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-modal-header">
              <h3>📲 How to Install App on Mobile</h3>
              <button className="pwa-modal-close" onClick={() => setShowGuideModal(false)}>
                ✕
              </button>
            </div>
            <div className="pwa-modal-body">
              {isIOS ? (
                <div className="pwa-guide-section">
                  <h4>iPhone / iPad (Safari):</h4>
                  <ol>
                    <li>Tap the <strong>Share</strong> icon (bottom navigation bar).</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong> (➕).</li>
                    <li>Tap <strong>Add</strong> in top right corner.</li>
                  </ol>
                </div>
              ) : (
                <div className="pwa-guide-section">
                  <h4>Android (Chrome / Edge):</h4>
                  <ol>
                    <li>Tap the <strong>3 dots (⋮)</strong> menu in top right corner.</li>
                    <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Follow screen prompt to confirm installation.</li>
                  </ol>
                </div>
              )}
              <div className="pwa-modal-note">
                ⚡ Once installed, open the app from your home screen to use all emergency features completely offline!
              </div>
            </div>
            <button className="pwa-modal-done-btn" onClick={() => setShowGuideModal(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

