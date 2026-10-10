const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth, requireRole } = require("../util/auth");
const { distanceKm } = require("../util/geo");

const router = express.Router();

const { ngoResponseStatus, syncReportResponse, RESPONSE_ORDER } = require("../util/workflow");

function ngoFor(db, userId) {
  return (db.ngo_profiles || []).find((n) => n && n.user_id === userId) || null;
}

router.get("/notifications", requireAuth, requireRole("ngo"), (req, res) => {
  try {
    const dbData = readDb();
    const ngo = ngoFor(dbData, req.user.id);
    if (!ngo) return res.status(404).json({ error: "NGO profile not found" });

    const results = (dbData.notifications || [])
      .filter((n) => n && n.ngo_id === ngo.id)
      .map((n) => {
        const report = (dbData.reports || []).find((r) => r && r.id === n.report_id);
        if (!report) return null;
        const media = (dbData.media || []).filter((m) => m && m.report_id === n.report_id);
        const votes = (dbData.votes || []).filter((v) => v.report_id === report.id && v.vote_tier === "local");
        const up = votes.filter((v) => v.vote_type === "up").length;
        const dist = ngo.service_lat != null ? Math.round(distanceKm(ngo.service_lat, ngo.service_lng, report.lat, report.lng) * 10) / 10 : null;
        return {
          ...report, // report fields first so notification fields below win on any name clash
          media,
          totalVotes: votes.length,
          upvotePct: votes.length ? Math.round((up / votes.length) * 1000) / 10 : 0,
          notification_id: n.id,
          notified_at: n.created_at,
          distance_km: n.distance_km ?? dist,
          delivery_channel: n.delivery_channel || "in_app",
          delivery_status: n.delivery_status || "available_in_dashboard",
          response_status: ngoResponseStatus(n),
          acknowledged_at: n.acknowledged_at || null,
          response_updated_at: n.response_updated_at || null,
          response_note: n.response_note || "",
          history: n.history || [],
        };
      })
      .filter(Boolean);

    return res.json({ ngo, notifications: results, statuses: RESPONSE_ORDER });
  } catch (err) {
    console.error("NGO notifications error:", err.message);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Move a notification forward through new → acknowledged → responding → resolved. Forward-only; idempotent.
function applyResponse(req, res, target) {
  try {
    const dbData = readDb();
    const ngo = ngoFor(dbData, req.user.id);
    if (!ngo) return res.status(404).json({ error: "NGO profile not found" });
    if (ngo.verification_status !== "approved") return res.status(403).json({ error: "Your organisation is not yet approved by an administrator." });

    const notif = (dbData.notifications || []).find((n) => n && n.id === req.params.id);
    // Same 404 for "missing" and "not yours" so IDs can't be probed.
    if (!notif || notif.ngo_id !== ngo.id) return res.status(404).json({ error: "Notification not found" });

    const note = String((req.body && req.body.note) || "").trim().slice(0, 500);
    const current = ngoResponseStatus(notif);
    if (!RESPONSE_ORDER.includes(target)) return res.status(400).json({ error: `status must be one of: ${RESPONSE_ORDER.slice(1).join(", ")}` });

    const ci = RESPONSE_ORDER.indexOf(current);
    const ti = RESPONSE_ORDER.indexOf(target);
    if (ti < ci) return res.status(409).json({ error: `Cannot move from "${current}" back to "${target}".` });

    if (ti > ci || (note && note !== notif.response_note)) {
      const now = new Date().toISOString();
      if (!notif.history) notif.history = [];
      // Passing through "acknowledged" is implied when jumping ahead.
      if (ci < 1 && ti >= 1) { notif.acknowledged_at = now; if (ti > 1) notif.history.push({ at: now, event: "status", status: "acknowledged", by: req.user.id }); }
      if (ti > ci) notif.history.push({ at: now, event: "status", status: target, by: req.user.id, ...(note ? { note } : {}) });
      notif.response_status = target;
      notif.status = target === "new" ? notif.status : "acknowledged"; // legacy field
      notif.response_updated_at = now;
      if (note) notif.response_note = note;
      const report = dbData.reports.find((r) => r.id === notif.report_id);
      if (report) syncReportResponse(dbData, report);
      writeDb(dbData);
    }
    return res.json({ ok: true, notification_id: notif.id, response_status: ngoResponseStatus(notif), response_updated_at: notif.response_updated_at || null });
  } catch (err) {
    console.error("NGO response error:", err.message);
    return res.status(500).json({ error: "Could not update response" });
  }
}

router.post("/notifications/:id/ack", requireAuth, requireRole("ngo"), (req, res) => applyResponse(req, res, "acknowledged"));
router.post("/notifications/:id/status", requireAuth, requireRole("ngo"), (req, res) => applyResponse(req, res, String((req.body && req.body.status) || "")));

router.get("/public-list", (req, res) => {
  try {
    const { userLat, userLng } = req.query;
    const dbData = readDb();
    if (!dbData.ngo_profiles) dbData.ngo_profiles = [];
    if (!dbData.users) dbData.users = [];

    const approvedNgos = dbData.ngo_profiles.filter((n) => n && n.verification_status === "approved");

    const results = approvedNgos.map((ngo) => {
      const user = dbData.users.find((u) => u && u.id === ngo.user_id);
      let distance = null;
      if (userLat != null && userLng != null && ngo.service_lat != null && ngo.service_lng != null) {
        distance = Math.round(distanceKm(Number(userLat), Number(userLng), ngo.service_lat, ngo.service_lng) * 10) / 10;
      }

      // Only build payment links from a payment ID the NGO actually provided — never a placeholder.
      const upi = ngo.upi_id || null;
      const upiUri = upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(ngo.org_name || "NGO")}&cu=INR&tn=${encodeURIComponent("Calamity Relief Donation")}` : null;
      const qrUrl = upiUri ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}` : null;

      return {
        ...ngo,
        user_name: user ? user.name : ngo.org_name,
        user_email: user ? user.email : "",
        distanceKm: distance,
        upiUri,
        qrUrl,
      };
    });

    return res.json({ ngos: results });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch NGO network" });
  }
});

module.exports = router;
