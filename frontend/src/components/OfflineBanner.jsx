import { useState, useEffect } from "react";
import { getPendingReports, getPendingVotes, syncAllPending } from "../util/offlineStore";
import { api } from "../api/client";
import SmsFallbackModal from "./SmsFallbackModal";
import "./OfflineBanner.css";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [showAutoSmsPopup, setShowAutoSmsPopup] = useState(!navigator.onLine);
  const [userCoords, setUserCoords] = useState(null);

  const refreshCount = async () => {
    try {
      const reports = await getPendingReports();
      const votes = await getPendingVotes();
      setPendingCount(reports.length + votes.length);
    } catch (e) {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    refreshCount();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 3500 }
      );
    }

    const handleOnline = () => {
      setIsOnline(true);
      setShowAutoSmsPopup(false);
      handleSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowAutoSmsPopup(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = setInterval(refreshCount, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    setSyncMsg("Syncing queued reports...");
    try {
      const res = await syncAllPending(api);
      if (res.syncedReports > 0 || res.syncedVotes > 0) {
        setSyncMsg(`Synced ${res.syncedReports} report(s) and ${res.syncedVotes} vote(s) successfully!`);
        setTimeout(() => setSyncMsg(""), 4000);
      } else {
        setSyncMsg("");
      }
    } catch (e) {
      setSyncMsg("Sync failed. Will retry automatically.");
    } finally {
      setSyncing(false);
      refreshCount();
    }
  };

  return (
    <>
      {(!isOnline || pendingCount > 0 || syncMsg) && (
        <div className={`offline-banner ${!isOnline ? "is-offline" : "is-online-sync"}`}>
          <div className="offline-banner-content">
            <span className="offline-icon">{!isOnline ? "📡 Offline" : "🟢 Back Online"}</span>
            <span className="offline-text">
              {!isOnline
                ? `No Internet. ${pendingCount} report(s) queued for auto-sync.`
                : syncMsg || `${pendingCount} item(s) ready to sync.`}
            </span>
            {!isOnline && (
              <button
                className="sync-btn"
                onClick={() => setShowAutoSmsPopup(true)}
                style={{ background: "#ef4444", color: "#fff" }}
              >
                📲 Emergency SMS Dispatch
              </button>
            )}
            {pendingCount > 0 && isOnline && (
              <button className="sync-btn" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "⚡ Sync Now"}
              </button>
            )}
          </div>
        </div>
      )}

      {showAutoSmsPopup && (
        <SmsFallbackModal
          reportData={{
            category: "FLOOD",
            severity: "CRITICAL",
            title: "EMERGENCY RESCUE DISPATCH",
            lat: userCoords?.lat || 28.6139,
            lng: userCoords?.lng || 77.2090,
          }}
          onClose={() => setShowAutoSmsPopup(false)}
        />
      )}
    </>
  );
}
