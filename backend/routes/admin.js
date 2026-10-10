const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../util/auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!["admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Requires admin privileges" });
  }
  next();
}

function requireSeniorOrAdmin(req, res, next) {
  if (!["senior_moderator", "admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Requires senior moderator or admin privileges" });
  }
  next();
}

// ── MODERATOR APPLICATIONS ──

// List all applications
router.get("/moderator-applications", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];

    const applications = dbData.moderatorApplications.map((app) => {
      const user = (dbData.users || []).find((u) => u.id === app.user_id);
      const profile = (dbData.moderatorProfiles || []).find((p) => p.user_id === app.user_id);
      return {
        ...app,
        user_name: user ? user.name : app.full_name,
        user_email: user ? user.email : "",
        has_profile: !!profile,
        training_completed: profile?.training_completed || false,
        training_score: profile?.training_score || null,
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ applications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Approve application
router.post("/moderator-applications/:id/approve", requireAuth, requireAdmin, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];
    if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];

    const app = dbData.moderatorApplications.find((a) => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    app.status = "approved";
    app.reviewed_by = req.user.id;
    app.reviewed_at = new Date().toISOString();

    // Update user role
    const user = (dbData.users || []).find((u) => u.id === app.user_id);
    if (user) user.role = "student_moderator";

    // Create moderator profile if not exists
    const existingProfile = dbData.moderatorProfiles.find((p) => p.user_id === app.user_id);
    if (!existingProfile) {
      dbData.moderatorProfiles.push({
        id: uuidv4(),
        user_id: app.user_id,
        application_id: app.id,
        status: "approved",
        level: "trainee",
        trust_score: 50,
        accuracy: 100,
        total_reviews: 0,
        approvals: 0,
        rejections: 0,
        escalations: 0,
        correct_decisions: 0,
        incorrect_decisions: 0,
        audited_count: 0,
        training_completed: false,
        training_score: null,
        training_attempts: 0,
        training_completed_at: null,
        daily_task_limit: 10,
        last_active: null,
        created_at: new Date().toISOString(),
      });
    }

    writeDb(dbData);
    return res.json({ success: true, application: app, message: "Application approved. User has been granted Student Moderator access." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Reject application
router.post("/moderator-applications/:id/reject", requireAuth, requireAdmin, (req, res) => {
  try {
    const { reason } = req.body;
    const dbData = readDb();
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];

    const app = dbData.moderatorApplications.find((a) => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    app.status = "rejected";
    app.reviewed_by = req.user.id;
    app.reviewed_at = new Date().toISOString();
    app.rejection_reason = reason || "Application does not meet current requirements";

    writeDb(dbData);
    return res.json({ success: true, application: app });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Request training
router.post("/moderator-applications/:id/request-training", requireAuth, requireAdmin, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];

    const app = dbData.moderatorApplications.find((a) => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    app.status = "training_required";
    app.reviewed_by = req.user.id;
    app.reviewed_at = new Date().toISOString();

    writeDb(dbData);
    return res.json({ success: true, application: app });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── MODERATOR MANAGEMENT ──

// List all moderators
router.get("/moderators", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorProfiles) return res.json({ moderators: [] });

    const moderators = dbData.moderatorProfiles.map((profile) => {
      const user = (dbData.users || []).find((u) => u.id === profile.user_id);
      const app = (dbData.moderatorApplications || []).find((a) => a.user_id === profile.user_id);
      const credits = (dbData.walletTransactions || []).filter(
        (t) => t.moderator_id === profile.user_id && t.type === "credit"
      );
      const payouts = (dbData.walletTransactions || []).filter(
        (t) => t.moderator_id === profile.user_id && t.type === "payout"
      );
      const totalEarned = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalPaid = payouts.reduce((sum, t) => sum + (t.amount || 0), 0);

      return {
        ...profile,
        user_name: user ? user.name : "Moderator",
        user_email: user ? user.email : "",
        user_role: user ? user.role : "",
        college: app ? app.college : "",
        course: app ? app.course : "",
        city: app ? app.city : "",
        total_earned: totalEarned,
        wallet_balance: Math.max(0, totalEarned - totalPaid),
      };
    }).sort((a, b) => b.total_reviews - a.total_reviews);

    return res.json({ moderators });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Suspend moderator
router.post("/moderators/:userId/suspend", requireAuth, requireAdmin, (req, res) => {
  try {
    const { reason } = req.body;
    const dbData = readDb();
    if (!dbData.moderatorProfiles) return res.status(404).json({ error: "No profiles found" });

    const profile = dbData.moderatorProfiles.find((p) => p.user_id === req.params.userId);
    if (!profile) return res.status(404).json({ error: "Moderator profile not found" });

    const user = (dbData.users || []).find((u) => u.id === req.params.userId);

    profile.status = "suspended";
    profile.suspended_at = new Date().toISOString();
    profile.suspension_reason = reason || "Suspended by administrator";
    if (user) user.role = "citizen"; // Revoke moderator role

    writeDb(dbData);
    return res.json({ success: true, profile, message: "Moderator suspended and role revoked." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Reactivate moderator
router.post("/moderators/:userId/reactivate", requireAuth, requireAdmin, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorProfiles) return res.status(404).json({ error: "No profiles found" });

    const profile = dbData.moderatorProfiles.find((p) => p.user_id === req.params.userId);
    if (!profile) return res.status(404).json({ error: "Moderator profile not found" });

    const user = (dbData.users || []).find((u) => u.id === req.params.userId);

    profile.status = "approved";
    profile.suspended_at = null;
    profile.suspension_reason = null;
    if (user) user.role = "student_moderator";

    writeDb(dbData);
    return res.json({ success: true, profile, message: "Moderator reactivated." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Promote to trusted moderator
router.post("/moderators/:userId/promote", requireAuth, requireAdmin, (req, res) => {
  try {
    const { level } = req.body;
    const validLevels = ["trainee", "verified", "trusted", "senior"];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: `Level must be one of: ${validLevels.join(", ")}` });
    }

    const dbData = readDb();
    const profile = (dbData.moderatorProfiles || []).find((p) => p.user_id === req.params.userId);
    if (!profile) return res.status(404).json({ error: "Moderator profile not found" });

    const user = (dbData.users || []).find((u) => u.id === req.params.userId);

    profile.level = level;
    if (level === "senior") {
      profile.daily_task_limit = 50;
      if (user) user.role = "senior_moderator";
    } else if (level === "trusted") {
      profile.daily_task_limit = 25;
    } else if (level === "verified") {
      profile.daily_task_limit = 15;
    }

    writeDb(dbData);
    return res.json({ success: true, profile, message: `Moderator promoted to ${level}.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AUDIT MANAGEMENT ──

// List audits
router.get("/audits", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorAudits) return res.json({ audits: [] });

    const audits = dbData.moderatorAudits.map((audit) => {
      const moderator = (dbData.users || []).find((u) => u.id === audit.moderator_id);
      const report = (dbData.reports || []).find((r) => r.id === audit.report_id);
      return {
        ...audit,
        moderator_name: moderator ? moderator.name : "Unknown",
        report_title: report ? report.title : audit.report_id,
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ audits });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Submit audit decision
router.post("/audits", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const { decision_id, audit_result, audit_notes } = req.body;
    if (!decision_id || !["correct", "incorrect", "partial"].includes(audit_result)) {
      return res.status(400).json({ error: "decision_id and audit_result (correct/incorrect/partial) required" });
    }

    const dbData = readDb();
    if (!dbData.moderationDecisions) return res.status(404).json({ error: "No decisions found" });
    if (!dbData.moderatorAudits) dbData.moderatorAudits = [];
    if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];

    const decision = dbData.moderationDecisions.find((d) => d.id === decision_id);
    if (!decision) return res.status(404).json({ error: "Decision not found" });

    decision.audit_status = audit_result;
    decision.audited_by = req.user.id;
    decision.audited_at = new Date().toISOString();

    // Create audit record
    const audit = {
      id: uuidv4(),
      decision_id,
      report_id: decision.report_id,
      moderator_id: decision.moderator_id,
      auditor_id: req.user.id,
      original_action: decision.action,
      audit_result,
      audit_notes: audit_notes || "",
      created_at: new Date().toISOString(),
    };
    dbData.moderatorAudits.push(audit);

    // Update moderator profile accuracy & trust score
    const profile = dbData.moderatorProfiles.find((p) => p.user_id === decision.moderator_id);
    if (profile) {
      profile.audited_count = (profile.audited_count || 0) + 1;

      if (audit_result === "correct") {
        profile.correct_decisions = (profile.correct_decisions || 0) + 1;
        profile.trust_score = Math.min(100, (profile.trust_score || 50) + 2);
      } else if (audit_result === "incorrect") {
        profile.incorrect_decisions = (profile.incorrect_decisions || 0) + 1;
        profile.trust_score = Math.max(0, (profile.trust_score || 50) - 5);
        // Deduct from wallet for incorrect approval (penalty)
        if (decision.action === "approve" && dbData.walletTransactions) {
          const penalty = 5; // ₹5 clawback
          dbData.walletTransactions.push({
            id: uuidv4(),
            moderator_id: decision.moderator_id,
            decision_id: decision.id,
            report_id: decision.report_id,
            report_title: "Audit Penalty",
            type: "penalty",
            amount: penalty,
            status: "deducted",
            created_at: new Date().toISOString(),
          });
        }
      }

      // Recalculate accuracy
      const total = (profile.correct_decisions || 0) + (profile.incorrect_decisions || 0);
      if (total > 0) {
        profile.accuracy = Math.round(((profile.correct_decisions || 0) / total) * 1000) / 10;
      }

      // Level progression
      if (profile.accuracy >= 95 && profile.total_reviews >= 40) {
        profile.level = "trusted";
        profile.daily_task_limit = 25;
      } else if (profile.accuracy >= 85 && profile.total_reviews >= 15) {
        profile.level = "verified";
        profile.daily_task_limit = 15;
      }
    }

    writeDb(dbData);
    return res.json({ success: true, audit, message: "Audit recorded and moderator stats updated." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Analytics overview
router.get("/analytics", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const dbData = readDb();
    const reports = dbData.reports || [];
    const decisions = dbData.moderationDecisions || [];
    const applications = dbData.moderatorApplications || [];
    const profiles = dbData.moderatorProfiles || [];

    const statusCounts = {};
    reports.forEach((r) => {
      const s = r.moderation_status || "PENDING_MODERATOR";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const totalDecisions = decisions.length;
    const approvals = decisions.filter((d) => d.action === "approve").length;
    const rejections = decisions.filter((d) => d.action === "reject").length;
    const escalations = decisions.filter((d) => d.action === "escalate").length;
    const pendingApplications = applications.filter((a) => a.status === "pending").length;
    const activeModeratorCount = profiles.filter((p) => p.status === "approved").length;

    return res.json({
      analytics: {
        totalReports: reports.length,
        statusCounts,
        totalDecisions,
        approvals,
        rejections,
        escalations,
        approvalRate: totalDecisions > 0 ? Math.round((approvals / totalDecisions) * 100) : 0,
        rejectionRate: totalDecisions > 0 ? Math.round((rejections / totalDecisions) * 100) : 0,
        escalationRate: totalDecisions > 0 ? Math.round((escalations / totalDecisions) * 100) : 0,
        pendingApplications,
        activeModeratorCount,
        totalApplications: applications.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── NGO VERIFICATION ──
router.get("/ngos", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  const ngos = (db.ngo_profiles || []).map((n) => {
    const u = (db.users || []).find((x) => x.id === n.user_id);
    return { ...n, user_name: u ? u.name : n.org_name, user_email: u ? u.email : "" };
  });
  return res.json({ ngos });
});

function setNgoStatus(status) {
  return (req, res) => {
    const db = readDb();
    const ngo = (db.ngo_profiles || []).find((n) => n.id === req.params.id);
    if (!ngo) return res.status(404).json({ error: "NGO not found" });
    ngo.verification_status = status;
    ngo.verified_by = req.user.id;
    ngo.verified_at = new Date().toISOString();
    writeDb(db);
    return res.json({ success: true, ngo });
  };
}
router.post("/ngos/:id/approve", requireAuth, requireAdmin, setNgoStatus("approved"));
router.post("/ngos/:id/reject", requireAuth, requireAdmin, setNgoStatus("rejected"));

module.exports = router;
