const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../util/auth");

const router = express.Router();

// Notifications + flagged report details for the logged-in NGO
router.get("/notifications", requireAuth, requireRole("ngo"), (req, res) => {
  const ngo = db.prepare("SELECT * FROM ngo_profiles WHERE user_id = ?").get(req.user.id);
  if (!ngo) return res.status(404).json({ error: "NGO profile not found" });

  const rows = db
    .prepare(
      `SELECT n.id as notification_id, n.status as notification_status, n.created_at as notified_at,
              r.* FROM notifications n
       JOIN reports r ON r.id = n.report_id
       WHERE n.ngo_id = ?
       ORDER BY n.created_at DESC`
    )
    .all(ngo.id);

  const results = rows.map((r) => {
    const media = db.prepare("SELECT id, file_path, file_type FROM media WHERE report_id = ?").all(r.id);
    const totalVotes = r.upvotes + r.downvotes;
    const upvotePct = totalVotes > 0 ? Math.round((r.upvotes / totalVotes) * 1000) / 10 : 0;
    return { ...r, media, totalVotes, upvotePct };
  });

  res.json({ ngo, notifications: results });
});

router.post("/notifications/:id/ack", requireAuth, requireRole("ngo"), (req, res) => {
  db.prepare("UPDATE notifications SET status = 'acknowledged' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
