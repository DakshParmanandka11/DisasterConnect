const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { db, getConfig } = require("../db");
const { requireAuth } = require("../util/auth");
const { distanceKm } = require("../util/geo");
const realtime = require("../realtime");

const exifr = require("exifr");
const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

async function extractExif(filePath, reportLat, reportLng) {
  try {
    const data = await exifr.parse(filePath, { gps: true, tiff: true });
    if (!data) return { status: "missing" };
    
    const lat = data.latitude;
    const lng = data.longitude;
    const date = data.DateTimeOriginal || data.CreateDate;
    const timestampStr = date ? new Date(date).toISOString() : null;

    if (lat != null && lng != null) {
      const dist = distanceKm(reportLat, reportLng, lat, lng);
      const isFresh = date ? (Date.now() - new Date(date).getTime()) < 48 * 3600 * 1000 : true;
      if (dist <= 2.0 && isFresh) {
        return { status: "verified", lat, lng, timestamp: timestampStr };
      } else {
        return { status: "suspicious", lat, lng, timestamp: timestampStr };
      }
    }
    return { status: "missing", timestamp: timestampStr };
  } catch (err) {
    return { status: "missing" };
  }
}

function checkSpatialDensityAndAutoFlag(lat, lng) {
  const radiusKm = getConfig("spatial_density_radius_km") || 2.0;
  const windowMin = getConfig("spatial_density_window_min") || 30;
  const threshold = getConfig("spatial_density_count_threshold") || 3;
  const cutoff = new Date(Date.now() - windowMin * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

  const recentReports = db
    .prepare("SELECT * FROM reports WHERE created_at >= ? AND status != 'resolved'")
    .all(cutoff);

  const inRadius = recentReports.filter((r) => distanceKm(lat, lng, r.lat, r.lng) <= radiusKm);
  
  if (inRadius.length >= threshold) {
    const updateStmt = db.prepare(
      "UPDATE reports SET status = 'flagged', flagged_at = datetime('now'), spatial_density_score = ? WHERE id = ?"
    );
    for (const r of inRadius) {
      if (r.status === "pending") {
        updateStmt.run(inRadius.length, r.id);
        notifyNearbyNGOs(r.id, r.lat, r.lng);
        const updated = reportWithMedia(r.id);
        realtime.emit("report:flagged", updated);
      }
    }
    return { autoFlagged: true, count: inRadius.length };
  }
  return { autoFlagged: false, count: inRadius.length };
}

function reportWithMedia(reportId) {
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
  if (!report) return null;
  const media = db.prepare("SELECT id, file_path, file_type FROM media WHERE report_id = ?").all(reportId);
  const author = db.prepare("SELECT id, name FROM users WHERE id = ?").get(report.user_id);
  const totalVotes = report.upvotes + report.downvotes;
  const upvotePct = totalVotes > 0 ? Math.round((report.upvotes / totalVotes) * 1000) / 10 : 0;

  let clusterSiblings = [];
  let confirmations = 1;
  if (report.cluster_id) {
    clusterSiblings = db
      .prepare(
        "SELECT id, title, created_at, user_id FROM reports WHERE cluster_id = ? AND id != ? ORDER BY created_at ASC"
      )
      .all(report.cluster_id, report.id);
    confirmations = clusterSiblings.length + 1;
  }

  return { ...report, media, author, totalVotes, upvotePct, clusterSiblings, confirmations };
}

// Find other active reports nearby, same category, within the recency window —
// used to auto-cluster likely-duplicate reports of the same real-world incident.
function findDuplicateCandidates(category, lat, lng, excludeId) {
  const radiusKm = getConfig("duplicate_cluster_radius_km");
  const windowHours = getConfig("duplicate_cluster_window_hours");
  const cutoff = new Date(Date.now() - windowHours * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);

  const candidates = db
    .prepare(
      `SELECT * FROM reports WHERE category = ? AND status != 'resolved' AND id != ? AND created_at >= ?`
    )
    .all(category, excludeId, cutoff);

  return candidates.filter((c) => distanceKm(lat, lng, c.lat, c.lng) <= radiusKm);
}

function linkCluster(newReportId, candidates) {
  if (candidates.length === 0) return null;
  const withCluster = candidates.find((c) => c.cluster_id);
  const clusterId = withCluster ? withCluster.cluster_id : candidates[0].id;

  const updateStmt = db.prepare("UPDATE reports SET cluster_id = ? WHERE id = ?");
  updateStmt.run(clusterId, newReportId);
  for (const c of candidates) {
    if (!c.cluster_id) updateStmt.run(clusterId, c.id);
  }
  return clusterId;
}

// Create report
router.post("/", requireAuth, upload.array("media", 5), async (req, res) => {
  const { title, description, category, severity, lat, lng } = req.body;
  if (!title || !category || lat == null || lng == null) {
    return res.status(400).json({ error: "title, category, lat, and lng are required" });
  }
  const id = uuidv4();
  const numLat = Number(lat);
  const numLng = Number(lng);

  const files = req.files || [];
  let exifRes = { status: "missing" };
  
  if (files.length > 0) {
    const firstImg = files.find(f => f.mimetype.startsWith("image"));
    if (firstImg) {
      exifRes = await extractExif(firstImg.path, numLat, numLng);
    }
  }

  db.prepare(
    `INSERT INTO reports (id, user_id, title, description, category, severity, lat, lng, exif_status, exif_lat, exif_lng, exif_timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.id,
    title,
    description || "",
    category,
    severity || "moderate",
    numLat,
    numLng,
    exifRes.status,
    exifRes.lat || null,
    exifRes.lng || null,
    exifRes.timestamp || null
  );

  const insertMedia = db.prepare(
    "INSERT INTO media (id, report_id, file_path, file_type) VALUES (?, ?, ?, ?)"
  );
  for (const f of files) {
    const type = f.mimetype.startsWith("video") ? "video" : "image";
    insertMedia.run(uuidv4(), id, `/uploads/${f.filename}`, type);
  }

  const candidates = findDuplicateCandidates(category, numLat, numLng, id);
  const clusterId = linkCluster(id, candidates);

  // Check spatial density auto-verification
  const densityRes = checkSpatialDensityAndAutoFlag(numLat, numLng);

  const report = reportWithMedia(id);
  realtime.emit("report:new", report);
  if (clusterId) realtime.emit("report:updated", report);

  res.status(201).json({
    report,
    duplicateNotice:
      candidates.length > 0
        ? { count: candidates.length, siblings: candidates.map((c) => ({ id: c.id, title: c.title })) }
        : null,
    spatialDensityTriggered: densityRes.autoFlagged,
    exifStatus: exifRes.status,
  });
});

// Public feed
router.get("/", (req, res) => {
  const { status, category, lat, lng, maxDistanceKm } = req.query;
  let reports = db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all();

  if (status) reports = reports.filter((r) => r.status === status);
  if (category) reports = reports.filter((r) => r.category === category);
  if (lat != null && lng != null && maxDistanceKm) {
    reports = reports.filter(
      (r) => distanceKm(Number(lat), Number(lng), r.lat, r.lng) <= Number(maxDistanceKm)
    );
  }

  const full = reports.map((r) => reportWithMedia(r.id));
  res.json({ reports: full });
});

// Report detail
router.get("/:id", (req, res) => {
  const report = reportWithMedia(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ report });
});

function tallyAndMaybeFlag(reportId) {
  const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
  const totalVotes = updated.upvotes + updated.downvotes;
  const minQuorum = getConfig("min_vote_quorum");
  const threshold = getConfig("verification_threshold_pct");
  const upvotePct = totalVotes > 0 ? (updated.upvotes / totalVotes) * 100 : 0;

  let flaggedNow = false;
  if (updated.status === "pending" && totalVotes >= minQuorum && upvotePct > threshold) {
    db.prepare("UPDATE reports SET status = 'flagged', flagged_at = datetime('now') WHERE id = ?").run(
      reportId
    );
    flaggedNow = true;
    notifyNearbyNGOs(reportId, updated.lat, updated.lng);
  }
  return flaggedNow;
}

// Vote on a report — eligibility computed server-side from the voter's
// submitted current location (browser geolocation), never trusted from client claims of eligibility.
router.post("/:id/vote", requireAuth, (req, res) => {
  const { vote_type, lat, lng } = req.body;
  if (!["up", "down"].includes(vote_type) || lat == null || lng == null) {
    return res.status(400).json({ error: "vote_type (up/down) and current lat/lng are required" });
  }

  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });

  const votingRadiusKm = getConfig("voting_radius_km");
  const dist = distanceKm(Number(lat), Number(lng), report.lat, report.lng);
  const isRemote = dist > votingRadiusKm;
  const voteTier = isRemote ? "remote" : "local";

  const existing = db
    .prepare("SELECT * FROM votes WHERE report_id = ? AND user_id = ?")
    .get(report.id, req.user.id);

  if (isRemote) {
    if (existing) {
      return res.status(409).json({ error: "You've already cast a remote support signal for this report." });
    }
    db.prepare(
      "INSERT INTO votes (id, report_id, user_id, vote_type, voter_lat, voter_lng, vote_tier) VALUES (?, ?, ?, ?, ?, ?, 'remote')"
    ).run(uuidv4(), report.id, req.user.id, "up", lat, lng);
    
    db.prepare("UPDATE reports SET remote_votes = remote_votes + 1 WHERE id = ?").run(report.id);
    const updatedReport = reportWithMedia(report.id);
    realtime.emit("report:updated", updatedReport);
    return res.json({
      report: updatedReport,
      voteTier: "remote",
      message: `Remote Signal Vote recorded! Since you are ${dist.toFixed(1)} km away (> ${votingRadiusKm} km limit), your vote boosts crisis visibility without diluting local ground-truth verification.`,
    });
  }

  if (existing) {
    if (report.status !== "pending") {
      return res.status(403).json({ error: "Voting is locked — this report has already been flagged." });
    }
    if (existing.vote_type === vote_type) {
      return res.status(409).json({ error: "You've already cast this vote." });
    }
    db.prepare("UPDATE votes SET vote_type = ?, voter_lat = ?, voter_lng = ?, vote_tier = 'local' WHERE id = ?").run(
      vote_type,
      lat,
      lng,
      existing.id
    );
    const upDelta = vote_type === "up" ? 1 : -1;
    const downDelta = vote_type === "down" ? 1 : -1;
    db.prepare("UPDATE reports SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?").run(
      upDelta,
      downDelta,
      report.id
    );
  } else {
    db.prepare(
      "INSERT INTO votes (id, report_id, user_id, vote_type, voter_lat, voter_lng, vote_tier) VALUES (?, ?, ?, ?, ?, ?, 'local')"
    ).run(uuidv4(), report.id, req.user.id, vote_type, lat, lng);
    const col = vote_type === "up" ? "upvotes" : "downvotes";
    db.prepare(`UPDATE reports SET ${col} = ${col} + 1 WHERE id = ?`).run(report.id);
  }

  const flaggedNow = tallyAndMaybeFlag(report.id);
  const updatedReport = reportWithMedia(report.id);
  realtime.emit("report:updated", updatedReport);
  if (flaggedNow) realtime.emit("report:flagged", updatedReport);

  res.json({ report: updatedReport, flaggedNow, voteTier: "local" });
});

// DEMO TOOL — instantly simulates a batch of eligible nearby votes so the
// verification -> auto-flag -> NGO notification pipeline can be demonstrated
// live without manually registering many accounts. Clearly labeled in the UI
// as a demo aid; simulated voters are real synthetic accounts subject to the
// same one-vote-per-user and radius rules as everyone else.
router.post("/:id/simulate-votes", requireAuth, (req, res) => {
  const bcrypt = require("bcryptjs");
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  if (report.status !== "pending") {
    return res.status(400).json({ error: "This report is no longer pending — nothing to simulate." });
  }

  const minQuorum = getConfig("min_vote_quorum");
  const votingRadiusKm = getConfig("voting_radius_km");
  const currentTotal = report.upvotes + report.downvotes;
  const toAdd = Math.max(minQuorum - currentTotal, 5);
  const passHash = bcrypt.hashSync("demo-voter-pass", 4);

  const insertUser = db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'citizen')"
  );
  const insertVote = db.prepare(
    "INSERT INTO votes (id, report_id, user_id, vote_type, voter_lat, voter_lng) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const castVotes = [];
  for (let i = 0; i < toAdd; i++) {
    const userId = uuidv4();
    const suffix = Math.random().toString(36).slice(2, 8);
    insertUser.run(userId, `Local Voter ${suffix}`, `demo-${suffix}@voters.local`, passHash);

    const distKm = Math.random() * (votingRadiusKm * 0.9);
    const bearing = Math.random() * 2 * Math.PI;
    const dLat = (distKm / 111) * Math.cos(bearing);
    const dLng = (distKm / (111 * Math.cos((report.lat * Math.PI) / 180))) * Math.sin(bearing);
    const voterLat = report.lat + dLat;
    const voterLng = report.lng + dLng;

    const voteType = Math.random() < 0.78 ? "up" : "down";
    insertVote.run(uuidv4(), report.id, userId, voteType, voterLat, voterLng);
    const col = voteType === "up" ? "upvotes" : "downvotes";
    db.prepare(`UPDATE reports SET ${col} = ${col} + 1 WHERE id = ?`).run(report.id);

    castVotes.push({ voteType, voterLat, voterLng });
  }

  const flaggedNow = tallyAndMaybeFlag(report.id);
  const updatedReport = reportWithMedia(report.id);
  realtime.emit("report:updated", updatedReport);
  if (flaggedNow) realtime.emit("report:flagged", updatedReport);

  res.json({ report: updatedReport, flaggedNow, simulatedVotes: castVotes });
});

function notifyNearbyNGOs(reportId, lat, lng) {
  const radius = getConfig("ngo_notify_radius_km");
  const ngos = db.prepare("SELECT * FROM ngo_profiles WHERE verification_status = 'approved'").all();
  const insertNotif = db.prepare(
    "INSERT INTO notifications (id, report_id, ngo_id) VALUES (?, ?, ?)"
  );
  for (const ngo of ngos) {
    const dist = distanceKm(lat, lng, ngo.service_lat, ngo.service_lng);
    if (dist <= radius) {
      insertNotif.run(uuidv4(), reportId, ngo.id);
    }
  }
}

// NGO / admin updates report status
router.post("/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ["under_review", "resolved"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
  }
  if (req.user.role !== "ngo" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only NGO or admin accounts can update report status" });
  }
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(status, req.params.id);
  const updatedReport = reportWithMedia(req.params.id);
  realtime.emit("report:updated", updatedReport);
  res.json({ report: updatedReport });
});

module.exports = router;
