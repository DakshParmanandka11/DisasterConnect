const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb, getConfig } = require("../db");
const { requireAuth } = require("../util/auth");
const { distanceKm } = require("../util/geo");
const { analyzeRelevance } = require("../util/relevance");
const { fetchLiveGroundTruth } = require("../util/webSearch");
const { extractOfficialTelemetry } = require("../util/tinyFishAgent");
const { verifyIncidentReport } = require("../util/aiVerifier");

const router = express.Router();

const fs = require("fs");

const uploadDir = (process.env.VERCEL || process.env.NODE_ENV === "production")
  ? "/tmp"
  : path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
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
  if (!dbData) return null;
  if (!dbData.reports) dbData.reports = [];
  if (!dbData.media) dbData.media = [];
  if (!dbData.users) dbData.users = [];

  const report = dbData.reports.find((r) => r && r.id === reportId);
  if (!report) return null;

  const media = dbData.media.filter((m) => m && m.report_id === reportId);
  const author = dbData.users.find((u) => u && u.id === report.user_id);
  const totalVotes = (report.upvotes || 0) + (report.downvotes || 0);
  const upvotePct = totalVotes > 0 ? Math.round(((report.upvotes || 0) / totalVotes) * 1000) / 10 : 0;

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
    totalVotes,
    upvotePct,
    clusterSiblings,
    confirmations,
    moderatorInfo,
  };
}

// Create report
router.post("/", requireAuth, upload.array("media", 5), async (req, res) => {
  try {
    const { title, description, category, severity, lat, lng, location } = req.body || {};
    if (!title || !category || lat == null || lng == null) {
      return res.status(400).json({ error: "Title, category, latitude, and longitude are required" });
    }

    const dbData = readDb();
    if (!dbData.reports) dbData.reports = [];
    if (!dbData.media) dbData.media = [];

    const id = uuidv4();
    const numLat = Number(lat);
    const numLng = Number(lng);
    const files = req.files || [];

    const relevanceAnalysis = analyzeRelevance ? analyzeRelevance(String(title), String(description || "")) : { relevanceScore: 95, gibberishScore: 0 };

    const newReport = {
      id,
      user_id: req.user ? req.user.id : "guest-citizen-anon-id",
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      category: String(category).toLowerCase(),
      severity: severity ? String(severity).toLowerCase() : "moderate",
      lat: numLat,
      lng: numLng,
      status: "pending",
      moderation_status: "PENDING_MODERATOR",
      relevance_score: relevanceAnalysis.relevanceScore,
      gibberish_score: relevanceAnalysis.gibberishScore,
      spam_score: relevanceAnalysis.spamScore || 0,
      duplicate_probability: relevanceAnalysis.duplicateProbability || 0,
      upvotes: 0,
      downvotes: 0,
      remote_votes: 0,
      exif_status: files.length > 0 ? "verified" : "missing",
      confirmations: 1,
      created_at: new Date().toISOString(),
    };

    // 3-Layer AI Verification Pipeline Step (Scout, Inspector, Synthesizer)
    // Layer 1 (The Scout - Tavily API)
    const socialSnippets = await fetchLiveGroundTruth(newReport);

    // Layer 2 (The Deep Inspector - TinyFish AI Agent / Official Telemetry)
    let telemetry = null;
    const highSeverityTypes = ["flood", "cyclone", "landslide", "dam leak", "dam_leak"];
    const reportCategory = String(newReport.category || newReport.type || "").toLowerCase();
    if (highSeverityTypes.some((t) => reportCategory.includes(t))) {
      telemetry = await extractOfficialTelemetry(newReport);
    }

    let mainImagePath = null;
    if (req.file && req.file.path) {
      mainImagePath = req.file.path;
    } else if (files.length > 0 && files[0].path) {
      mainImagePath = files[0].path;
    }

    // Layer 3 (The Synthesizer - Gemini 2.0 Flash Multimodal)
    const aiResult = await verifyIncidentReport({
      reportData: newReport,
      imagePath: mainImagePath,
      searchSnippets: socialSnippets,
      telemetryData: telemetry,
    });

    newReport.aiVerification = aiResult;

    dbData.reports.unshift(newReport);

    for (const f of files) {
      const type = (f.mimetype || "").startsWith("video") ? "video" : "image";
      dbData.media.push({
        id: uuidv4(),
        report_id: id,
        file_path: `/uploads/${f.filename}`,
        file_type: type,
        created_at: new Date().toISOString(),
      });
    }

    // Auto-assign to an available student moderator (round-robin by least tasks)
    if (!dbData.moderationTasks) dbData.moderationTasks = [];
    if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];
    const activeMods = (dbData.moderatorProfiles || []).filter(
      (p) => p.status === "approved" && p.training_completed
    );
    if (activeMods.length > 0) {
      // Find moderator with fewest pending tasks who hasn't submitted this report
      const taskCounts = {};
      activeMods.forEach((p) => { taskCounts[p.user_id] = 0; });
      (dbData.moderationTasks || []).forEach((t) => {
        if (t.status === "pending" && taskCounts[t.moderator_id] !== undefined) {
          taskCounts[t.moderator_id]++;
        }
      });
      // Exclude the reporter themselves
      const eligible = activeMods.filter((p) => p.user_id !== newReport.user_id);
      if (eligible.length > 0) {
        eligible.sort((a, b) => (taskCounts[a.user_id] || 0) - (taskCounts[b.user_id] || 0));
        const assignedMod = eligible[0];
        newReport.assigned_moderator_id = assignedMod.user_id;
        dbData.moderationTasks.push({
          id: uuidv4(),
          report_id: id,
          moderator_id: assignedMod.user_id,
          status: "pending",
          assigned_at: new Date().toISOString(),
          completed_at: null,
        });
      }
    }

    writeDb(dbData);

    const report = reportWithMedia(id, dbData);
    return res.status(201).json({ report, message: "Report submitted and entered moderation queue." });
  } catch (err) {
    console.error("Create Report Error:", err);
    return res.status(500).json({ error: err.message || "Failed to create report" });
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
