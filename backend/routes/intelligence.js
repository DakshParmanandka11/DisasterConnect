const express = require("express");
const crypto = require("crypto");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../util/auth");
const { gatherEvidence, isConfigured } = require("../services/tinyfish");

const router = express.Router();

const REVIEWER_ROLES = ["student_moderator", "senior_moderator", "admin"];
const REPORT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const TTL_OK_MS = 30 * 60 * 1000; // completed lookups are reused for 30 min
const TTL_FAIL_MS = 60 * 1000; // failures/partials may be retried after 60 s
const FORCE_COOLDOWN_MS = 15 * 1000; // "re-check" cannot be spammed

// ── Tiny in-memory per-user rate limiter (no new dependency) ──
const userHits = new Map();
function userRateLimit(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const arr = (userHits.get(req.user.id) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      res.set("Retry-After", String(Math.ceil((windowMs - (now - arr[0])) / 1000)));
      return res.status(429).json({ error: "Too many evidence lookups. Please wait a moment." });
    }
    arr.push(now);
    userHits.set(req.user.id, arr);
    next();
  };
}

function requireReviewer(req, res, next) {
  if (!REVIEWER_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "Evidence lookup is limited to moderators." });
  }
  next();
}

function fingerprint(report) {
  return crypto
    .createHash("sha1")
    .update([report.title, report.description, report.category, report.lat, report.lng].join("|"))
    .digest("hex");
}

/** Student moderators may only look up reports in their own task list; seniors/admins any report. */
function canAccessReport(user, report, dbData) {
  if (user.role === "senior_moderator" || user.role === "admin") return true;
  return (dbData.moderationTasks || []).some((t) => t.report_id === report.id && t.moderator_id === user.id);
}

function publicShape(report, rec, extra = {}) {
  if (!rec) {
    return { reportId: report.id, provider: "tinyfish", status: "not_checked", checkedAt: null, findings: [], error: null, configured: isConfigured(), ...extra };
  }
  return {
    reportId: report.id,
    provider: rec.provider,
    status: rec.status,
    checkedAt: rec.checkedAt,
    findings: rec.findings,
    error: rec.error,
    queries: rec.queries,
    configured: isConfigured(),
    advisory: "Search results are corroboration for a human moderator, not proof. Absence of results is not evidence a report is false.",
    ...extra,
  };
}

function loadReport(req, res, dbData) {
  const id = req.params.reportId;
  if (!REPORT_ID_RE.test(id)) {
    res.status(400).json({ error: "Invalid report id." });
    return null;
  }
  const report = (dbData.reports || []).find((r) => r.id === id);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return null;
  }
  if (!canAccessReport(req.user, report, dbData)) {
    res.status(403).json({ error: "This report is not assigned to you." });
    return null;
  }
  return report;
}

// Provider status — never reveals the key, only whether one is configured.
router.get("/status", requireAuth, requireReviewer, (req, res) => {
  res.json({ provider: "tinyfish", configured: isConfigured() });
});

// Read stored evidence without calling TinyFish.
router.get("/reports/:reportId/evidence", requireAuth, requireReviewer, (req, res) => {
  const dbData = readDb();
  const report = loadReport(req, res, dbData);
  if (!report) return;
  const rec = (dbData.evidence || []).find((e) => e.report_id === report.id);
  const stale = rec ? rec.fingerprint !== fingerprint(report) : false;
  res.json(publicShape(report, rec, { cached: Boolean(rec), stale }));
});

const inFlight = new Map(); // reportId -> Promise, so concurrent clicks share one upstream lookup

// Run (or reuse) an evidence lookup. This endpoint only ever writes to dbData.evidence;
// it never touches moderation_status, status, votes or notifications.
router.post(
  "/reports/:reportId/evidence",
  requireAuth,
  requireReviewer,
  userRateLimit(10, 60 * 1000),
  async (req, res) => {
    try {
      const first = readDb();
      const report = loadReport(req, res, first);
      if (!report) return;

      const fp = fingerprint(report);
      const force = Boolean(req.body && req.body.force);
      const existing = (first.evidence || []).find((e) => e.report_id === report.id);

      if (existing && existing.fingerprint === fp) {
        const age = Date.now() - new Date(existing.checkedAt).getTime();
        const ttl = existing.status === "completed" ? TTL_OK_MS : TTL_FAIL_MS;
        const notConfiguredNow = existing.error && existing.error.code === "NOT_CONFIGURED" && isConfigured();
        const withinCooldown = age < FORCE_COOLDOWN_MS;
        if (!notConfiguredNow && ((!force && age < ttl) || (force && withinCooldown))) {
          return res.json(publicShape(report, existing, { cached: true }));
        }
      }

      let promise = inFlight.get(report.id);
      if (!promise) {
        promise = gatherEvidence(report).finally(() => inFlight.delete(report.id));
        inFlight.set(report.id, promise);
      }
      const result = await promise;

      // Re-read AFTER the await: the DB may have changed while we were waiting on the network.
      const db = readDb();
      if (!db.evidence) db.evidence = [];
      const rec = {
        report_id: report.id,
        fingerprint: fp,
        provider: result.provider,
        status: result.status,
        checkedAt: result.checkedAt,
        findings: result.findings,
        error: result.error,
        queries: result.queries,
      };
      const idx = db.evidence.findIndex((e) => e.report_id === report.id);
      if (idx >= 0) db.evidence[idx] = rec;
      else db.evidence.push(rec);
      writeDb(db);

      // 200 even for upstream failure: the *lookup* is a best-effort side feature, and the
      // structured `status`/`error` fields tell the UI what happened.
      return res.json(publicShape(report, rec, { cached: false }));
    } catch (err) {
      console.error("Evidence route error:", err && err.name ? err.name : "error");
      return res.status(500).json({ error: "Evidence lookup failed unexpectedly. Moderation is unaffected." });
    }
  }
);

module.exports = router;
