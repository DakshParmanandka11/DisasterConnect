const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb, getConfig } = require("../db");
const { requireAuth, optionalAuth } = require("../util/auth");
const { distanceKm } = require("../util/geo");
const { analyzeRelevance } = require("../util/relevance");
const { PUBLISHED, VOTABLE, tally, verificationParams, evaluateVerification } = require("../util/workflow");

const router = express.Router();

const fs = require("fs");

const uploadDir = (process.env.VERCEL || process.env.NODE_ENV === "production")
  ? "/tmp"
  : path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
}

const ALLOWED_MIME = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
  "video/mp4": ".mp4", "video/webm": ".webm",
};
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const CATEGORIES = ["flood", "fire", "earthquake", "tsunami", "landslide", "building_collapse", "storm", "cyclone", "other"];
const SEVERITIES = ["low", "moderate", "high", "critical"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // Server-generated name; the client-supplied filename/extension is never used on disk.
  filename: (req, file, cb) => cb(null, `${uuidv4()}${ALLOWED_MIME[file.mimetype] || ".bin"}`),
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      const e = new Error(`Unsupported file type "${String(file.mimetype).slice(0, 40)}". Allowed: JPEG, PNG, WebP, MP4, WebM.`);
      e.code = "UNSUPPORTED_MEDIA";
      return cb(e);
    }
    cb(null, true);
  },
});
function uploadMedia(req, res, next) {
  upload.array("media", 5)(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).` });
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ error: "Too many files (max 5)." });
    if (err.code === "UNSUPPORTED_MEDIA") return res.status(415).json({ error: err.message });
    return res.status(400).json({ error: "Upload failed." });
  });
}
function discardFiles(files) {
  for (const f of files || []) { try { fs.unlinkSync(f.path); } catch (_) {} }
}

function reportWithMedia(reportId, dbData = readDb()) {
  if (!dbData) return null;
  if (!dbData.reports) dbData.reports = [];
  if (!dbData.media) dbData.media = [];
  if (!dbData.users) dbData.users = [];

  const report = dbData.reports.find((r) => r && r.id === reportId);
  if (!report) return null;

  const media = dbData.media.filter((m) => m && m.report_id === reportId);
  const author = dbData.users.find((u) => u && u.id === report.user_id);
  const t = tally(dbData, report.id);
  const totalVotes = t.total;
  const upvotePct = t.upPct;
  const vp = verificationParams();

  let clusterSiblings = [];
  let confirmations = 1;
  if (report.cluster_id) {
    clusterSiblings = dbData.reports
      .filter((r) => r && r.cluster_id === report.cluster_id && r.id !== report.id)
      .map((r) => ({ id: r.id, title: r.title, created_at: r.created_at, user_id: r.user_id }));
    confirmations = clusterSiblings.length + 1;
  }

  let moderatorInfo = null;
  if (report.moderated_by) {
    const mod = dbData.users.find((u) => u && u.id === report.moderated_by);
    if (mod) moderatorInfo = { id: mod.id, name: mod.name };
  }

  return {
    ...report,
    media,
    author: author ? { id: author.id, name: author.name } : { id: "unknown", name: "Citizen" },
    upvotes: t.up,
    downvotes: t.down,
    remote_votes: t.remote,
    totalVotes,
    upvotePct,
    verification: {
      local_votes: t.total,
      upvote_pct: t.upPct,
      quorum: vp.quorum,
      threshold_pct: vp.thresholdPct,
      radius_km: vp.radiusKm,
      quorum_met: t.total >= vp.quorum,
      threshold_met: t.upPct >= vp.thresholdPct,
      votes_needed_for_quorum: Math.max(0, vp.quorum - t.total),
    },
    clusterSiblings,
    confirmations,
    moderatorInfo,
  };
}

// Create report
router.post("/", optionalAuth, uploadMedia, (req, res) => {
  const files = req.files || [];
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "").trim().toLowerCase().replace(/\s+/g, "_");
    const severity = String(body.severity || "moderate").trim().toLowerCase();
    const numLat = Number(body.lat);
    const numLng = Number(body.lng);

    const errors = [];
    if (title.length < 5 || title.length > 140) errors.push("Title must be 5–140 characters.");
    if (description.length > 2000) errors.push("Description must be at most 2000 characters.");
    if (!CATEGORIES.includes(category)) errors.push(`Category must be one of: ${CATEGORIES.join(", ")}.`);
    if (!SEVERITIES.includes(severity)) errors.push(`Severity must be one of: ${SEVERITIES.join(", ")}.`);
    if (body.lat === "" || body.lat == null || !Number.isFinite(numLat) || numLat < -90 || numLat > 90) errors.push("Latitude must be a number between -90 and 90.");
    if (body.lng === "" || body.lng == null || !Number.isFinite(numLng) || numLng < -180 || numLng > 180) errors.push("Longitude must be a number between -180 and 180.");

    // Optional: when the incident happened (defaults to submission time). Not in the future; max 30 days old.
    let incidentAt = null;
    if (body.incident_time) {
      const t = Date.parse(String(body.incident_time));
      if (Number.isNaN(t) || t > Date.now() + 5 * 60 * 1000 || t < Date.now() - 30 * 24 * 3600 * 1000) errors.push("incident_time must be a valid time within the last 30 days.");
      else incidentAt = new Date(t).toISOString();
    }
    if (errors.length) { discardFiles(files); return res.status(400).json({ error: errors[0], errors }); }

    const dbData = readDb();
    if (!dbData.reports) dbData.reports = [];
    if (!dbData.media) dbData.media = [];

    const id = uuidv4();
    const now = new Date().toISOString();
    const relevanceAnalysis = analyzeRelevance(title, description);

    const newReport = {
      id,
      user_id: req.user.id,
      title,
      description,
      category,
      severity,
      lat: numLat,
      lng: numLng,
      status: "pending",
      moderation_status: "PENDING_MODERATOR",
      // Heuristic (rule-based) screening — not a trained classifier.
      screening_method: "rule_based_heuristic",
      relevance_score: relevanceAnalysis.relevanceScore,
      gibberish_score: relevanceAnalysis.gibberishScore,
      spam_score: relevanceAnalysis.spamScore || 0,
      duplicate_probability: relevanceAnalysis.duplicateProbability || 0,
      upvotes: 0,
      downvotes: 0,
      remote_votes: 0,
      // Honest media/location states. We do not parse EXIF, so a file's existence proves nothing.
      media_check_status: files.length > 0 ? "not_checked" : "no_media",
      exif_status: files.length > 0 ? "not_checked" : "no_media",
      location_evidence: "coordinates_supplied_unverified",
      incident_at: incidentAt || now,
      confirmations: 1,
      created_at: now,
    };
    dbData.reports.unshift(newReport);

    for (const f of files) {
      dbData.media.push({
        id: uuidv4(),
        report_id: id,
        file_path: `/uploads/${f.filename}`,
        file_type: f.mimetype.startsWith("video") ? "video" : "image",
        mime_type: f.mimetype,
        size_bytes: f.size,
        original_name: String(f.originalname || "").replace(/[^\w.\- ]/g, "_").slice(0, 80),
        metadata_status: "not_checked",
        created_at: now,
      });
    }

    // Auto-assign to an available student moderator (fewest pending tasks, never the reporter)
    if (!dbData.moderationTasks) dbData.moderationTasks = [];
    const activeMods = (dbData.moderatorProfiles || []).filter((p) => p.status === "approved" && p.training_completed);
    const taskCounts = {};
    activeMods.forEach((p) => { taskCounts[p.user_id] = 0; });
    dbData.moderationTasks.forEach((t) => { if (t.status === "pending" && taskCounts[t.moderator_id] !== undefined) taskCounts[t.moderator_id]++; });
    const eligible = activeMods.filter((p) => p.user_id !== newReport.user_id).sort((a, b) => (taskCounts[a.user_id] || 0) - (taskCounts[b.user_id] || 0));
    if (eligible.length > 0) {
      newReport.assigned_moderator_id = eligible[0].user_id;
      dbData.moderationTasks.push({ id: uuidv4(), report_id: id, moderator_id: eligible[0].user_id, status: "pending", assigned_at: now, completed_at: null });
    }

    writeDb(dbData);
    return res.status(201).json({ report: reportWithMedia(id, dbData), message: "Report submitted and entered moderation queue." });
  } catch (err) {
    discardFiles(files);
    console.error("Create Report Error:", err.message);
    return res.status(500).json({ error: "Failed to create report" });
  }
});

// Public feed
router.get("/", (req, res) => {
  const { status, category, lat, lng, maxDistanceKm, moderation_status } = req.query;
  const dbData = readDb();

  let reports = [...dbData.reports];

  if (moderation_status) {
    reports = reports.filter((r) => r.moderation_status === moderation_status);
  } else {
    // Only show reports that have passed moderation
    const visibleStatuses = [
      "APPROVED_BY_MODERATOR",
      "APPROVED_BY_SENIOR",
      "COMMUNITY_VERIFIED",
      "NGO_DISPATCHED",
      // Legacy statuses for backward-compat
      "approved",
    ];
    reports = reports.filter((r) => visibleStatuses.includes(r.moderation_status));
  }

  if (status) reports = reports.filter((r) => r.status === status);
  if (category) reports = reports.filter((r) => r.category === category);
  if (lat != null && lng != null && maxDistanceKm) {
    reports = reports.filter(
      (r) => distanceKm(Number(lat), Number(lng), r.lat, r.lng) <= Number(maxDistanceKm)
    );
  }

  const full = reports.map((r) => reportWithMedia(r.id, dbData));
  res.json({ reports: full });
});

// Report detail
router.get("/:id", optionalAuth, (req, res) => {
  const report = reportWithMedia(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  // Unpublished reports (pending / rejected / escalated) are visible only to their author and reviewers.
  const published = PUBLISHED.includes(report.moderation_status) || report.moderation_status === "approved";
  const privileged = ["student_moderator", "senior_moderator", "admin"].includes(req.user.role) || report.user_id === req.user.id;
  if (!published && !privileged) return res.status(404).json({ error: "Report not found" });
  res.json({ report });
});

// Vote on a report. Every rule is enforced here from stored records; nothing is trusted from the client
// except the voter's self-reported position (browser geolocation) — see README "Known limitations".
router.post("/:id/vote", requireAuth, (req, res) => {
  try {
    const { vote_type } = req.body || {};
    const vLat = Number(req.body && req.body.lat);
    const vLng = Number(req.body && req.body.lng);
    if (!["up", "down"].includes(vote_type)) return res.status(400).json({ error: "vote_type must be 'up' or 'down'." });
    if (!Number.isFinite(vLat) || !Number.isFinite(vLng) || Math.abs(vLat) > 90 || Math.abs(vLng) > 180) {
      return res.status(400).json({ error: "A valid current latitude/longitude is required to vote." });
    }
    if (req.user.id === "guest-citizen-anon-id") return res.status(401).json({ error: "Please sign in to vote." });
    if (req.user.role !== "citizen") return res.status(403).json({ error: "Only citizen accounts can cast community votes." });

    const dbData = readDb();
    if (!dbData.votes) dbData.votes = [];
    const report = dbData.reports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (!VOTABLE.includes(report.moderation_status)) return res.status(409).json({ error: "This report is not open for community voting." });
    if (report.user_id === req.user.id) return res.status(403).json({ error: "You cannot vote on your own report." });
    if (dbData.votes.some((v) => v.report_id === report.id && v.user_id === req.user.id)) {
      return res.status(409).json({ error: "You have already voted on this report." });
    }

    const { radiusKm } = verificationParams();
    const dist = distanceKm(vLat, vLng, report.lat, report.lng);
    const isRemote = dist > radiusKm;
    if (isRemote && vote_type === "down") {
      return res.status(403).json({ error: `Only people within ${radiusKm} km can dispute a report. You can still add a support signal.` });
    }

    dbData.votes.push({
      id: uuidv4(),
      report_id: report.id,
      user_id: req.user.id,
      vote_type: isRemote ? "up" : vote_type,
      voter_lat: vLat,
      voter_lng: vLng,
      distance_km: Math.round(dist * 10) / 10,
      vote_tier: isRemote ? "remote" : "local", // remote signals never count toward verification
      created_at: new Date().toISOString(),
    });

    const result = evaluateVerification(dbData, report);
    writeDb(dbData);

    return res.json({
      report: reportWithMedia(report.id, dbData),
      voteTier: isRemote ? "remote" : "local",
      flaggedNow: result.transitioned,
      ngosNotified: result.notified.length,
      message: isRemote
        ? "Support signal recorded. It boosts visibility but does not count toward verification."
        : result.transitioned ? "Community verification threshold reached." : "Vote recorded.",
    });
  } catch (err) {
    console.error("Vote error:", err.message);
    return res.status(500).json({ error: "Could not record vote" });
  }
});

module.exports = router;
