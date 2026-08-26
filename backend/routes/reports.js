const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb, getConfig } = require("../db");
const { requireAuth } = require("../util/auth");
const { distanceKm } = require("../util/geo");
const { analyzeRelevance } = require("../util/relevance");

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
  limits: { fileSize: 50 * 1024 * 1024 },
});

function reportWithMedia(reportId, dbData = readDb()) {
  const report = dbData.reports.find((r) => r.id === reportId);
  if (!report) return null;

  const media = dbData.media.filter((m) => m.report_id === reportId);
  const author = dbData.users.find((u) => u.id === report.user_id);
  const totalVotes = (report.upvotes || 0) + (report.downvotes || 0);
  const upvotePct = totalVotes > 0 ? Math.round(((report.upvotes || 0) / totalVotes) * 1000) / 10 : 0;

  let clusterSiblings = [];
  let confirmations = 1;
  if (report.cluster_id) {
    clusterSiblings = dbData.reports
      .filter((r) => r.cluster_id === report.cluster_id && r.id !== report.id)
      .map((r) => ({ id: r.id, title: r.title, created_at: r.created_at, user_id: r.user_id }));
    confirmations = clusterSiblings.length + 1;
  }

  let moderatorInfo = null;
  if (report.moderated_by) {
    const mod = dbData.users.find((u) => u.id === report.moderated_by);
    if (mod) moderatorInfo = { id: mod.id, name: mod.name };
  }

  return {
    ...report,
    media,
    author: author ? { id: author.id, name: author.name } : { id: "unknown", name: "Citizen" },
    totalVotes,
    upvotePct,
    clusterSiblings,
    confirmations,
    moderatorInfo,
  };
}

// Create report
router.post("/", requireAuth, upload.array("media", 5), (req, res) => {
  const { title, description, category, severity, lat, lng } = req.body;
  if (!title || !category || lat == null || lng == null) {
    return res.status(400).json({ error: "title, category, lat, and lng are required" });
  }

  const dbData = readDb();
  const id = uuidv4();
  const numLat = Number(lat);
  const numLng = Number(lng);
  const files = req.files || [];

  const relevanceAnalysis = analyzeRelevance(title, description);

  const newReport = {
    id,
    user_id: req.user.id,
    title,
    description: description || "",
    category,
    severity: severity || "moderate",
    lat: numLat,
    lng: numLng,
    status: "pending",
    moderation_status: "pending",
    relevance_score: relevanceAnalysis.relevanceScore,
    gibberish_score: relevanceAnalysis.gibberishScore,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    created_at: new Date().toISOString(),
  };

  dbData.reports.unshift(newReport);

  for (const f of files) {
    const type = f.mimetype.startsWith("video") ? "video" : "image";
    dbData.media.push({
      id: uuidv4(),
      report_id: id,
      file_path: `/uploads/${f.filename}`,
      file_type: type,
      created_at: new Date().toISOString(),
    });
  }

  writeDb(dbData);

  const report = reportWithMedia(id, dbData);
  res.status(201).json({ report });
});

// Public feed
router.get("/", (req, res) => {
  const { status, category, lat, lng, maxDistanceKm, moderation_status } = req.query;
  const dbData = readDb();

  let reports = [...dbData.reports];

  if (moderation_status) {
    reports = reports.filter((r) => r.moderation_status === moderation_status);
  } else {
    reports = reports.filter(
      (r) => r.moderation_status !== "reject_gibberish" && r.moderation_status !== "reject_irrelevant"
    );
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
router.get("/:id", (req, res) => {
  const report = reportWithMedia(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ report });
});

// Vote on a report
router.post("/:id/vote", requireAuth, (req, res) => {
  const { vote_type, lat, lng } = req.body;
  if (!["up", "down"].includes(vote_type) || lat == null || lng == null) {
    return res.status(400).json({ error: "vote_type (up/down) and current lat/lng are required" });
  }

  const dbData = readDb();
  const report = dbData.reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });

  const votingRadiusKm = getConfig("voting_radius_km") || 10;
  const dist = distanceKm(Number(lat), Number(lng), report.lat, report.lng);
  const isRemote = dist > votingRadiusKm;

  const existingVote = dbData.votes.find((v) => v.report_id === report.id && v.user_id === req.user.id);

  if (isRemote) {
    if (existingVote) {
      return res.status(409).json({ error: "You've already cast a support signal for this report." });
    }
    dbData.votes.push({
      id: uuidv4(),
      report_id: report.id,
      user_id: req.user.id,
      vote_type: "up",
      voter_lat: lat,
      voter_lng: lng,
      vote_tier: "remote",
      created_at: new Date().toISOString(),
    });
    report.remote_votes = (report.remote_votes || 0) + 1;
    writeDb(dbData);

    const updated = reportWithMedia(report.id, dbData);
    return res.json({
      report: updated,
      voteTier: "remote",
      message: `Remote Signal Vote recorded! Boosts incident visibility.`,
    });
  }

  if (existingVote) {
    if (existingVote.vote_type === vote_type) {
      return res.status(409).json({ error: "You've already cast this vote." });
    }
    existingVote.vote_type = vote_type;
    if (vote_type === "up") {
      report.upvotes = (report.upvotes || 0) + 1;
      report.downvotes = Math.max(0, (report.downvotes || 0) - 1);
    } else {
      report.downvotes = (report.downvotes || 0) + 1;
      report.upvotes = Math.max(0, (report.upvotes || 0) - 1);
    }
  } else {
    dbData.votes.push({
      id: uuidv4(),
      report_id: report.id,
      user_id: req.user.id,
      vote_type,
      voter_lat: lat,
      voter_lng: lng,
      vote_tier: "local",
      created_at: new Date().toISOString(),
    });
    if (vote_type === "up") report.upvotes = (report.upvotes || 0) + 1;
    else report.downvotes = (report.downvotes || 0) + 1;
  }

  writeDb(dbData);
  const updated = reportWithMedia(report.id, dbData);
  res.json({ report: updated, voteTier: "local" });
});

module.exports = router;
