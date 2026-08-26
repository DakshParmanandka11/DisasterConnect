import { useState, useEffect } from "react";
import { getPendingReports, getPendingVotes, syncAllPending } from "../util/offlineStore";
import { api } from "../api/client";
import "./OfflineBanner.css";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

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

    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
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

  if (isOnline && pendingCount === 0 && !syncMsg) return null;

  return (
    <div className={`offline-banner ${!isOnline ? "is-offline" : "is-online-sync"}`}>
      <div className="offline-banner-content">
        <span className="offline-icon">{!isOnline ? "Offline" : "Back Online"}</span>
        <span className="offline-text">
          {!isOnline
            ? `Offline mode active. ${pendingCount} report(s) saved locally.`
            : syncMsg || `${pendingCount} item(s) ready to sync.`}
        </span>
        {pendingCount > 0 && isOnline && (
          <button className="sync-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        )}
      </div>
    </div>
  );
}
