const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth, requireRole } = require("../util/auth");
const { distanceKm } = require("../util/geo");

const router = express.Router();

router.get("/notifications", requireAuth, requireRole("ngo"), (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.ngo_profiles) dbData.ngo_profiles = [];
    if (!dbData.notifications) dbData.notifications = [];
    if (!dbData.reports) dbData.reports = [];
    if (!dbData.media) dbData.media = [];

    const ngo = dbData.ngo_profiles.find((n) => n && n.user_id === req.user.id);
    if (!ngo) return res.status(404).json({ error: "NGO profile not found" });

    const notifications = dbData.notifications.filter((n) => n && n.ngo_id === ngo.id);
    const results = notifications.map((n) => {
      const report = dbData.reports.find((r) => r && r.id === n.report_id);
      const media = dbData.media.filter((m) => m && m.report_id === n.report_id);
      const totalVotes = report ? (report.upvotes || 0) + (report.downvotes || 0) : 0;
      const upvotePct = totalVotes > 0 && report ? Math.round(((report.upvotes || 0) / totalVotes) * 1000) / 10 : 0;

      return {
        notification_id: n.id,
        notification_status: n.status,
        notified_at: n.created_at,
        ...(report || {}),
        media,
        totalVotes,
        upvotePct,
      };
    });

    return res.json({ ngo, notifications: results });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

router.post("/notifications/:id/ack", requireAuth, requireRole("ngo"), (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.notifications) dbData.notifications = [];
    const notif = dbData.notifications.find((n) => n && n.id === req.params.id);
    if (notif) notif.status = "acknowledged";
    writeDb(dbData);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

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

      const upi = ngo.upi_id || "relief-ngo@upi";
      const upiUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(ngo.org_name || "NGO")}&cu=INR&tn=${encodeURIComponent("Calamity Relief Donation")}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

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
