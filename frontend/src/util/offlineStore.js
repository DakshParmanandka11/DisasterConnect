const DB_NAME = "DisasterConnectDB";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject("IndexedDB open error: " + e.target.error);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pending_reports")) {
        db.createObjectStore("pending_reports", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pending_votes")) {
        db.createObjectStore("pending_votes", { keyPath: "id" });
      }
    };
  });
}

export async function savePendingReport(reportData) {
  const db = await openDB();
  const tx = db.transaction("pending_reports", "readwrite");
  const store = tx.objectStore("pending_reports");
  const id = reportData.id || "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const record = { ...reportData, id, timestamp: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e);
  });
}

export async function getPendingReports() {
  const db = await openDB();
  const tx = db.transaction("pending_reports", "readonly");
  const store = tx.objectStore("pending_reports");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

export async function deletePendingReport(id) {
  const db = await openDB();
  const tx = db.transaction("pending_reports", "readwrite");
  const store = tx.objectStore("pending_reports");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

export async function savePendingVote(voteData) {
  const db = await openDB();
  const tx = db.transaction("pending_votes", "readwrite");
  const store = tx.objectStore("pending_votes");
  const id = "vote_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const record = { ...voteData, id, timestamp: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e);
  });
}

export async function getPendingVotes() {
  const db = await openDB();
  const tx = db.transaction("pending_votes", "readonly");
  const store = tx.objectStore("pending_votes");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

export async function deletePendingVote(id) {
  const db = await openDB();
  const tx = db.transaction("pending_votes", "readwrite");
  const store = tx.objectStore("pending_votes");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

export async function syncAllPending(apiClient) {
  if (!navigator.onLine) return { syncedReports: 0, syncedVotes: 0 };

  const reports = await getPendingReports();
  let syncedReports = 0;
  for (const r of reports) {
    try {
      const formData = new FormData();
      formData.append("title", r.title);
      formData.append("description", r.description || "");
      formData.append("category", r.category);
      formData.append("severity", r.severity);
      formData.append("lat", r.lat);
      formData.append("lng", r.lng);
      if (r.files && r.files.length > 0) {
        for (const file of r.files) {
          formData.append("media", file);
        }
      }
      await apiClient.post("/reports", formData);
      await deletePendingReport(r.id);
      syncedReports++;
    } catch (e) {
      console.error("Failed to sync offline report:", r.id, e);
    }
  }

  const votes = await getPendingVotes();
  let syncedVotes = 0;
  for (const v of votes) {
    try {
      await apiClient.post(`/reports/${v.reportId}/vote`, {
        vote_type: v.voteType,
        lat: v.lat,
        lng: v.lng,
      });
      await deletePendingVote(v.id);
      syncedVotes++;
    } catch (e) {
      console.error("Failed to sync offline vote:", v.id, e);
    }
  }

  return { syncedReports, syncedVotes };
}
