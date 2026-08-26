const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../util/auth");
const { analyzeRelevance } = require("../util/relevance");

const router = express.Router();
const REWARD_PER_REVIEW = 5.0; // ₹5 per review

function requireModerator(req, res, next) {
  if (req.user.role !== "moderator" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Requires moderator privileges" });
  }
  next();
}

// Pending posts queue
router.get("/queue", requireAuth, requireModerator, (req, res) => {
  const { status = "pending", limit = 20 } = req.query;
  const dbData = readDb();

  const pendingReports = dbData.reports
    .filter((r) => (r.moderation_status || "pending") === status)
    .slice(0, Number(limit));

  const items = pendingReports.map((r) => {
    const media = dbData.media.filter((m) => m.report_id === r.id);
    const author = dbData.users.find((u) => u.id === r.user_id);
    const analysis = analyzeRelevance(r.title, r.description);

    return {
      ...r,
      media,
      author: author ? { id: author.id, name: author.name, email: author.email } : null,
      analysis,
    };
  });

  res.json({ queue: items });
});

// Submit review verdict
router.post("/review/:reportId", requireAuth, requireModerator, (req, res) => {
  const { action, note } = req.body;
  const allowed = ["approve", "reject_gibberish", "reject_irrelevant"];
  if (!allowed.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${allowed.join(", ")}` });
  }

  const dbData = readDb();
  const reportId = req.params.reportId;
  const report = dbData.reports.find((r) => r.id === reportId);
  if (!report) return res.status(404).json({ error: "Report not found" });

  const newStatus = action === "approve" ? "approved" : action;
  report.moderation_status = newStatus;
  report.moderated_by = req.user.id;
  report.moderated_at = new Date().toISOString();
  report.moderation_note = note || "";

  dbData.moderator_reviews.push({
    id: uuidv4(),
    moderator_id: req.user.id,
    report_id: report.id,
    action,
    reward_amount: REWARD_PER_REVIEW,
    created_at: new Date().toISOString(),
  });

  writeDb(dbData);

  res.json({
    success: true,
    report,
    earnedReward: REWARD_PER_REVIEW,
    message: `Post ${action === "approve" ? "approved" : "rejected"}. ₹${REWARD_PER_REVIEW} credited to your Moderator Wallet!`,
  });
});

// Moderator statistics & wallet
router.get("/stats", requireAuth, (req, res) => {
  const modId = req.user.id;
  const dbData = readDb();

  const reviews = dbData.moderator_reviews.filter((mr) => mr.moderator_id === modId);
  const payouts = dbData.moderator_payouts.filter((mp) => mp.moderator_id === modId);

  const totalEarned = reviews.reduce((sum, r) => sum + (r.reward_amount || 0), 0);
  const totalPaid = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const walletBalance = Math.max(0, totalEarned - totalPaid);

  const actionBreakdown = reviews.reduce((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1;
    return acc;
  }, {});

  const recentReviews = reviews.slice(-15).reverse().map((mr) => {
    const report = dbData.reports.find((r) => r.id === mr.report_id);
    return {
      ...mr,
      title: report ? report.title : "Report",
      category: report ? report.category : "general",
    };
  });

  res.json({
    stats: {
      totalReviews: reviews.length,
      totalEarned,
      totalPaid,
      walletBalance,
      rewardPerPost: REWARD_PER_REVIEW,
      actionBreakdown,
    },
    recentReviews,
    payouts,
  });
});

// Request student payout
router.post("/payout", requireAuth, requireModerator, (req, res) => {
  const { amount, upi_id } = req.body;
  if (!amount || amount <= 0 || !upi_id) {
    return res.status(400).json({ error: "amount (> 0) and upi_id are required" });
  }

  const modId = req.user.id;
  const dbData = readDb();

  const reviews = dbData.moderator_reviews.filter((mr) => mr.moderator_id === modId);
  const payouts = dbData.moderator_payouts.filter((mp) => mp.moderator_id === modId);

  const totalEarned = reviews.reduce((sum, r) => sum + (r.reward_amount || 0), 0);
  const totalPaid = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = Math.max(0, totalEarned - totalPaid);

  if (amount > balance) {
    return res.status(400).json({ error: `Insufficient wallet balance. Current balance is ₹${balance.toFixed(2)}` });
  }

  const payoutObj = {
    id: uuidv4(),
    moderator_id: modId,
    amount: Number(amount),
    payout_upi: upi_id,
    status: "completed",
    created_at: new Date().toISOString(),
  };

  dbData.moderator_payouts.push(payoutObj);
  writeDb(dbData);

  res.json({
    success: true,
    payout: payoutObj,
    remainingBalance: balance - amount,
    message: `Payout of ₹${amount} initiated successfully to ${upi_id}! Funds transferred via Instant UPI.`,
  });
});

// Leaderboard
router.get("/leaderboard", (req, res) => {
  const dbData = readDb();
  const modMap = new Map();

  for (const r of dbData.moderator_reviews) {
    const prev = modMap.get(r.moderator_id) || { reviews_completed: 0, total_earned: 0 };
    modMap.set(r.moderator_id, {
      reviews_completed: prev.reviews_completed + 1,
      total_earned: prev.total_earned + (r.reward_amount || 0),
    });
  }

  const leaderboard = [];
  for (const [modId, data] of modMap.entries()) {
    const user = dbData.users.find((u) => u.id === modId);
    leaderboard.push({
      id: modId,
      name: user ? user.name : "Student Moderator",
      reviews_completed: data.reviews_completed,
      total_earned: data.total_earned,
    });
  }

  leaderboard.sort((a, b) => b.total_earned - a.total_earned);
  res.json({ leaderboard: leaderboard.slice(0, 10) });
});

module.exports = router;
