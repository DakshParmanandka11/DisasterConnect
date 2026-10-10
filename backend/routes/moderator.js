const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb, getConfig } = require("../db");
const { requireAuth } = require("../util/auth");
const { analyzeRelevance } = require("../util/relevance");

const router = express.Router();

// ── Role Middleware ──

function requireStudentModerator(req, res, next) {
  const role = req.user.role;
  if (!["student_moderator", "senior_moderator", "admin"].includes(role)) {
    return res.status(403).json({ error: "Requires student moderator privileges" });
  }
  next();
}

function requireSeniorOrAdmin(req, res, next) {
  const role = req.user.role;
  if (!["senior_moderator", "admin"].includes(role)) {
    return res.status(403).json({ error: "Requires senior moderator or admin privileges" });
  }
  next();
}

function getModeratorProfile(userId, dbData) {
  if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];
  return dbData.moderatorProfiles.find((p) => p.user_id === userId) || null;
}

// ── Training Questions ──
const TRAINING_QUESTIONS = [
  {
    id: 1,
    scenario: "A report reads: \"Flooded road at Ring Road, Jamnagar. Knee-deep water. Several vehicles stranded. GPS attached.\"",
    options: [
      "Approve — legitimate disaster report with location, description and relevant details",
      "Reject — insufficient information",
      "Escalate — suspicious report",
    ],
    correct: 0,
    explanation: "This is a legitimate flood report with specific location, relevant description, and GPS data. It should be approved.",
  },
  {
    id: 2,
    scenario: "A report reads: \"OMG OMG OMG HELP!!!!!!!!!!!! PLEASE HELP OMG OMG!!!!\"",
    options: [
      "Approve — sounds like an emergency",
      "Reject — gibberish / insufficient information",
      "Escalate — could be serious",
    ],
    correct: 1,
    explanation: "This report contains no actionable information: no location, no event description, only panic text. It should be rejected as gibberish.",
  },
  {
    id: 3,
    scenario: "A report reads: \"Check out my new shoes — Red Nike Air Force 1s! Perfect for rainy season lol\"",
    options: [
      "Approve — mentions rainy season which is weather-related",
      "Reject — irrelevant content, not a disaster report",
      "Escalate — unclear intent",
    ],
    correct: 1,
    explanation: "This is clearly irrelevant consumer content, not a disaster report. It should be rejected as irrelevant.",
  },
  {
    id: 4,
    scenario: "A report says 'Flood at Sector 15 Noida' with an image showing a sunny street in another city from 2019 (reverse image search confirms this).",
    options: [
      "Approve — the text description mentions a flood",
      "Reject — misleading information, image does not match claim",
      "Escalate — potentially misleading media, needs senior review",
    ],
    correct: 2,
    explanation: "When media appears to be from a different location or time, the report should be escalated rather than directly rejected. A senior moderator should investigate.",
  },
  {
    id: 5,
    scenario: "A report about a gas leak explosion is filed with high relevance score (92%) but no GPS coordinates and no media attached.",
    options: [
      "Approve — AI score is high enough",
      "Reject — insufficient evidence",
      "Escalate — high-impact incident but no verifiable evidence",
    ],
    correct: 2,
    explanation: "High-impact incidents without any verifiable evidence (no GPS, no media) should be escalated so senior moderators can request more information before approving or rejecting.",
  },
  {
    id: 6,
    scenario: "Two reports arrive within 10 minutes from the same GPS coordinates describing the same flood. The second report is nearly identical.",
    options: [
      "Approve both — more reports increase credibility",
      "Reject the second report as a duplicate",
      "Escalate both reports",
    ],
    correct: 1,
    explanation: "A report that is nearly identical to an already-approved report from the same location should be rejected as a duplicate. Approving duplicates pollutes the incident pipeline.",
  },
  {
    id: 7,
    scenario: "AI gives a report a relevance score of 32% and flags it as potential gibberish. The description is short: 'fire help call'.",
    options: [
      "Trust the AI and immediately reject",
      "Review carefully — even brief genuine reports deserve consideration. If no further info is available, reject for insufficient evidence.",
      "Always approve short reports since it means the person was panicking",
    ],
    correct: 1,
    explanation: "Moderators should NEVER blindly trust AI scores. A brief report could be genuine. Review context and evidence. If truly insufficient, reject — but don't auto-reject based on AI alone.",
  },
  {
    id: 8,
    scenario: "A report claims 'The entire Brahmaputra river has flooded all of Assam. 50 million people affected.' No media, no coordinates, filed from an account registered today.",
    options: [
      "Approve — extreme events do happen",
      "Reject — clearly exaggerated and unverifiable",
      "Escalate — potentially high-impact claim requiring senior verification",
    ],
    correct: 2,
    explanation: "Extreme claims with no evidence from new accounts should be escalated, not rejected. If real, it could be critical. Senior moderators can contact emergency services to verify.",
  },
];

// ── APPLICATION ROUTES ──

// Submit application to become student moderator
router.post("/apply", requireAuth, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];

    // Check if already has moderator role
    const user = dbData.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (["student_moderator", "senior_moderator", "admin"].includes(user.role)) {
      return res.status(400).json({ error: "You already have moderator access" });
    }

    // Check existing application
    const existing = dbData.moderatorApplications.find((a) => a.user_id === req.user.id);
    if (existing) {
      return res.status(409).json({
        error: "You already have an application on file",
        application: existing,
      });
    }

    const {
      full_name, college, student_id, course, academic_year,
      college_email, phone, city, preferred_hours, reason,
    } = req.body;

    if (!full_name || !college || !student_id || !course || !academic_year || !college_email || !phone || !city || !reason) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const application = {
      id: uuidv4(),
      user_id: req.user.id,
      full_name: String(full_name).trim(),
      college: String(college).trim(),
      student_id: String(student_id).trim(),
      course: String(course).trim(),
      academic_year: String(academic_year).trim(),
      college_email: String(college_email).trim().toLowerCase(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      preferred_hours: String(preferred_hours || "Flexible").trim(),
      reason: String(reason).trim(),
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
    };

    dbData.moderatorApplications.push(application);
    writeDb(dbData);

    return res.status(201).json({ application, message: "Application submitted successfully. Our team will review it within 2–3 business days." });
  } catch (err) {
    console.error("Apply error:", err);
    return res.status(500).json({ error: err.message || "Failed to submit application" });
  }
});

// Get own application status
router.get("/application-status", requireAuth, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];
    if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];

    const application = dbData.moderatorApplications.find((a) => a.user_id === req.user.id);
    const profile = getModeratorProfile(req.user.id, dbData);

    return res.json({ application: application || null, profile: profile || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── TRAINING ROUTES ──

// Get training questions and status
router.get("/training/status", requireAuth, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.trainingAttempts) dbData.trainingAttempts = [];
    if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];

    const attempts = dbData.trainingAttempts.filter((t) => t.user_id === req.user.id);
    const profile = getModeratorProfile(req.user.id, dbData);

    const passed = attempts.find((a) => a.passed) || null;

    return res.json({
      questions: TRAINING_QUESTIONS.map((q) => ({
        id: q.id,
        scenario: q.scenario,
        options: q.options,
      })),
      attempts: attempts.length,
      passed: !!passed,
      best_score: attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null,
      training_completed: profile?.training_completed || false,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Submit training quiz
router.post("/training/submit", requireAuth, (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers) || answers.length !== TRAINING_QUESTIONS.length) {
      return res.status(400).json({ error: `Please answer all ${TRAINING_QUESTIONS.length} questions` });
    }

    const dbData = readDb();
    if (!dbData.trainingAttempts) dbData.trainingAttempts = [];
    if (!dbData.moderatorProfiles) dbData.moderatorProfiles = [];
    if (!dbData.moderatorApplications) dbData.moderatorApplications = [];

    // Score the answers
    let correct = 0;
    const results = TRAINING_QUESTIONS.map((q, i) => {
      const isCorrect = Number(answers[i]) === q.correct;
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        scenario: q.scenario,
        your_answer: answers[i],
        correct_answer: q.correct,
        is_correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correct / TRAINING_QUESTIONS.length) * 100);
    const minScore = Number(getConfig("min_training_score")) || 80;
    const passed = score >= minScore;

    const attempt = {
      id: uuidv4(),
      user_id: req.user.id,
      score,
      passed,
      answers: answers.map(Number),
      results,
      created_at: new Date().toISOString(),
    };

    dbData.trainingAttempts.push(attempt);

    // If passed, update/create moderator profile
    if (passed) {
      const profile = getModeratorProfile(req.user.id, dbData);
      if (profile) {
        profile.training_completed = true;
        profile.training_score = score;
        profile.training_completed_at = new Date().toISOString();
      } else {
        // Check if there's an approved application
        const application = dbData.moderatorApplications.find(
          (a) => a.user_id === req.user.id && a.status === "approved"
        );
        if (application) {
          dbData.moderatorProfiles.push({
            id: uuidv4(),
            user_id: req.user.id,
            application_id: application.id,
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
            training_completed: true,
            training_score: score,
            training_attempts: dbData.trainingAttempts.filter((t) => t.user_id === req.user.id).length,
            training_completed_at: new Date().toISOString(),
            daily_task_limit: 10,
            last_active: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    writeDb(dbData);

    return res.json({
      score,
      passed,
      correct,
      total: TRAINING_QUESTIONS.length,
      results,
      message: passed
        ? `Congratulations! You scored ${score}% and passed the training. You can now access the moderation queue.`
        : `You scored ${score}%. A minimum of ${minScore}% is required. Please review the guidelines and try again.`,
    });
  } catch (err) {
    console.error("Training submit error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── MODERATION TASK ROUTES ──

// Get tasks assigned to this moderator
router.get("/tasks", requireAuth, requireStudentModerator, (req, res) => {
  try {
    const dbData = readDb();
    const modId = req.user.id;
    const { status = "pending" } = req.query;

    if (!dbData.moderationTasks) dbData.moderationTasks = [];
    if (!dbData.reports) dbData.reports = [];
    if (!dbData.media) dbData.media = [];

    // Verify profile and training
    const profile = getModeratorProfile(modId, dbData);

    let tasks = dbData.moderationTasks.filter(
      (t) => t.moderator_id === modId && t.status === status
    );

    const enriched = tasks.map((task) => {
      const report = dbData.reports.find((r) => r.id === task.report_id);
      if (!report) return null;

      const media = dbData.media.filter((m) => m.report_id === report.id);
      const author = dbData.users
        ? dbData.users.find((u) => u.id === report.user_id)
        : null;

      const otherReports = dbData.reports.filter(
        (r) => r.id !== report.id && r.moderation_status !== "REJECTED_BY_MODERATOR"
      );
      const analysis = analyzeRelevance(report.title, report.description, otherReports);

      return {
        task_id: task.id,
        assigned_at: task.assigned_at,
        ...report,
        media,
        author: author ? { id: author.id, name: author.name, email: author.email } : { id: "unknown", name: "Citizen" },
        analysis: {
          relevanceScore: report.relevance_score || analysis.relevanceScore,
          gibberishScore: report.gibberish_score || analysis.gibberishScore,
          spamScore: report.spam_score || analysis.spamScore,
          duplicateProbability: report.duplicate_probability || analysis.duplicateProbability,
          locationEvidence: report.lat != null && report.lng != null ? "coordinates_supplied_unverified" : "none",
          flags: analysis.flags,
          detectedKeywords: analysis.detectedKeywords,
          isGibberish: analysis.isGibberish,
        },
      };
    }).filter(Boolean);

    return res.json({ tasks: enriched, profile });
  } catch (err) {
    console.error("Tasks error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Get single task detail
router.get("/tasks/:taskId", requireAuth, requireStudentModerator, (req, res) => {
  try {
    const dbData = readDb();
    const task = (dbData.moderationTasks || []).find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.moderator_id !== req.user.id && !["senior_moderator", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "This task is not assigned to you" });
    }

    const report = dbData.reports.find((r) => r.id === task.report_id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const media = dbData.media.filter((m) => m.report_id === report.id);
    const author = dbData.users ? dbData.users.find((u) => u.id === report.user_id) : null;
    const otherReports = dbData.reports.filter((r) => r.id !== report.id);
    const analysis = analyzeRelevance(report.title, report.description, otherReports);

    const votes = (dbData.votes || []).filter((v) => v.report_id === report.id);
    const localVotes = votes.filter((v) => v.vote_tier === "local");

    return res.json({
      task,
      report: {
        ...report,
        media,
        author: author ? { id: author.id, name: author.name, email: author.email } : { id: "unknown", name: "Citizen" },
        analysis: {
          relevanceScore: report.relevance_score || analysis.relevanceScore,
          gibberishScore: report.gibberish_score || analysis.gibberishScore,
          spamScore: report.spam_score || analysis.spamScore,
          duplicateProbability: report.duplicate_probability || analysis.duplicateProbability,
          locationEvidence: report.lat != null && report.lng != null ? "coordinates_supplied_unverified" : "none",
          flags: analysis.flags,
          detectedKeywords: analysis.detectedKeywords,
          isGibberish: analysis.isGibberish,
        },
        votes: { total: votes.length, local: localVotes.length, upvotes: report.upvotes, downvotes: report.downvotes },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Decision helper ──
const APPROVE_REASONS = [
  "Genuine disaster report",
  "Relevant media attached",
  "Location verified",
  "Sufficient information provided",
  "Consistent with surrounding reports",
  "Credible eyewitness account",
];

const REJECT_REASONS = [
  "Spam",
  "Gibberish / insufficient information",
  "Irrelevant",
  "Duplicate",
  "Misleading information",
  "Insufficient evidence",
  "Abusive content",
  "Suspicious media",
];

const ESCALATE_REASONS = [
  "Potentially serious incident requiring senior review",
  "Conflicting evidence",
  "Possible misinformation",
  "Location inconsistency",
  "High-impact incident with insufficient verification",
  "AI and human assessment disagree",
  "Requires senior moderator review",
];

function processDecision(req, res, action) {
  try {
    const dbData = readDb();
    const modId = req.user.id;
    const { taskId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "A reason is required for this decision" });
    }

    const task = (dbData.moderationTasks || []).find((t) => t.id === taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.moderator_id !== modId && !["senior_moderator", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "This task is not assigned to you" });
    }

    if (task.status !== "pending") {
      return res.status(409).json({ error: "This task has already been completed" });
    }

    const report = dbData.reports.find((r) => r.id === task.report_id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    // Anti-self-moderation check
    if (report.user_id === modId) {
      return res.status(403).json({ error: "You cannot moderate your own report" });
    }

    // Rate limiting: check reviews in the last 60 seconds (max 5)
    if (!dbData.moderationDecisions) dbData.moderationDecisions = [];
    const recentDecisions = dbData.moderationDecisions.filter(
      (d) => d.moderator_id === modId &&
      new Date(d.created_at) > new Date(Date.now() - 60 * 1000)
    );
    if (recentDecisions.length >= 5) {
      return res.status(429).json({ error: "Slow down — please take time to review each report carefully. You can submit up to 5 decisions per minute." });
    }

    // Perform the action
    const now = new Date().toISOString();
    const otherReports = dbData.reports.filter((r) => r.id !== report.id);
    const analysis = analyzeRelevance(report.title, report.description, otherReports);

    let newModerationStatus, rewardAmount, taskStatus;

    if (action === "approve") {
      newModerationStatus = "APPROVED_BY_MODERATOR";
      rewardAmount = Number(getConfig("reward_per_approve")) || 5;
      taskStatus = "completed";
    } else if (action === "reject") {
      newModerationStatus = "REJECTED_BY_MODERATOR";
      rewardAmount = Number(getConfig("reward_per_reject")) || 5;
      taskStatus = "completed";
    } else if (action === "escalate") {
      newModerationStatus = "ESCALATED";
      rewardAmount = Number(getConfig("reward_per_escalate")) || 3;
      taskStatus = "escalated";
    }

    // Update report
    report.moderation_status = newModerationStatus;
    report.moderated_by = modId;
    report.moderated_at = now;
    report.moderation_decision = action;
    report.moderation_reason = reason;
    if (action === "escalate") report.escalated_reason = reason;

    // Update task
    task.status = taskStatus;
    task.completed_at = now;

    // Create decision record
    const decision = {
      id: uuidv4(),
      task_id: taskId,
      report_id: report.id,
      moderator_id: modId,
      action,
      reason,
      notes: notes || "",
      ai_scores_at_decision: {
        relevance_score: report.relevance_score || analysis.relevanceScore,
        gibberish_score: report.gibberish_score || analysis.gibberishScore,
        spam_score: report.spam_score || analysis.spamScore,
        duplicate_probability: report.duplicate_probability || analysis.duplicateProbability,
        location_evidence: report.lat != null && report.lng != null ? "coordinates_supplied_unverified" : "none",
        method: "rule_based_heuristic",
      },
      reward_amount: rewardAmount,
      audit_status: "pending",
      audited_by: null,
      audited_at: null,
      created_at: now,
    };

    dbData.moderationDecisions.push(decision);

    // Create wallet transaction
    if (!dbData.walletTransactions) dbData.walletTransactions = [];
    const user = dbData.users.find((u) => u.id === modId);
    dbData.walletTransactions.push({
      id: uuidv4(),
      moderator_id: modId,
      decision_id: decision.id,
      report_id: report.id,
      report_title: report.title,
      type: "credit",
      amount: rewardAmount,
      status: "completed",
      created_at: now,
    });

    // Update moderator profile stats
    const profile = getModeratorProfile(modId, dbData);
    if (profile) {
      profile.total_reviews = (profile.total_reviews || 0) + 1;
      if (action === "approve") profile.approvals = (profile.approvals || 0) + 1;
      if (action === "reject") profile.rejections = (profile.rejections || 0) + 1;
      if (action === "escalate") profile.escalations = (profile.escalations || 0) + 1;
      profile.last_active = now;
    }

    // Random audit sampling (10% chance)
    const auditRate = Number(getConfig("audit_sample_rate")) || 0.1;
    if (Math.random() < auditRate && action !== "escalate") {
      decision.flagged_for_audit = true;
    }

    writeDb(dbData);

    return res.json({
      success: true,
      decision,
      report,
      earnedReward: rewardAmount,
      message: `Report ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "escalated"} successfully. ₹${rewardAmount} credited to your wallet.`,
    });
  } catch (err) {
    console.error(`${action} error:`, err);
    return res.status(500).json({ error: err.message });
  }
}

// Approve
router.post("/tasks/:taskId/approve", requireAuth, requireStudentModerator, (req, res) => {
  return processDecision(req, res, "approve");
});

// Reject
router.post("/tasks/:taskId/reject", requireAuth, requireStudentModerator, (req, res) => {
  return processDecision(req, res, "reject");
});

// Escalate
router.post("/tasks/:taskId/escalate", requireAuth, requireStudentModerator, (req, res) => {
  return processDecision(req, res, "escalate");
});

// Get decision reason options
router.get("/decision-reasons", (req, res) => {
  return res.json({ APPROVE_REASONS, REJECT_REASONS, ESCALATE_REASONS });
});

// ── ESCALATED QUEUE (Senior Moderators) ──

router.get("/escalated", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const dbData = readDb();
    const escalated = (dbData.reports || []).filter((r) => r.moderation_status === "ESCALATED");

    const enriched = escalated.map((report) => {
      const media = (dbData.media || []).filter((m) => m.report_id === report.id);
      const author = (dbData.users || []).find((u) => u.id === report.user_id);
      const originalMod = (dbData.users || []).find((u) => u.id === report.moderated_by);
      const analysis = analyzeRelevance(report.title, report.description);

      return {
        ...report,
        media,
        author: author ? { id: author.id, name: author.name } : { id: "unknown", name: "Citizen" },
        original_moderator: originalMod ? { id: originalMod.id, name: originalMod.name } : null,
        analysis,
      };
    });

    return res.json({ escalated: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Senior resolve escalated report
router.post("/escalated/:reportId/resolve", requireAuth, requireSeniorOrAdmin, (req, res) => {
  try {
    const dbData = readDb();
    const { action, reason } = req.body;
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    if (!reason) return res.status(400).json({ error: "reason is required" });

    const report = (dbData.reports || []).find((r) => r.id === req.params.reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.moderation_status !== "ESCALATED") {
      return res.status(400).json({ error: "Report is not in escalated state" });
    }

    const now = new Date().toISOString();
    report.moderation_status = action === "approve" ? "APPROVED_BY_SENIOR" : "REJECTED_BY_MODERATOR";
    report.senior_reviewed_by = req.user.id;
    report.senior_reviewed_at = now;
    report.moderation_reason = reason;
    report.moderation_decision = action;

    // Update any related task
    const task = (dbData.moderationTasks || []).find(
      (t) => t.report_id === report.id && t.status === "escalated"
    );
    if (task) {
      task.status = "completed";
      task.completed_at = now;
    }

    writeDb(dbData);
    return res.json({ success: true, report, message: `Escalated report ${action}d by senior moderator.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── STATS & WALLET ──

router.get("/stats", requireAuth, requireStudentModerator, (req, res) => {
  try {
    const modId = req.user.id;
    const dbData = readDb();

    if (!dbData.walletTransactions) dbData.walletTransactions = [];
    if (!dbData.moderationDecisions) dbData.moderationDecisions = [];

    const profile = getModeratorProfile(modId, dbData);
    const decisions = dbData.moderationDecisions.filter((d) => d.moderator_id === modId);

    const credits = dbData.walletTransactions.filter((t) => t.moderator_id === modId && t.type === "credit");
    const payouts = dbData.walletTransactions.filter((t) => t.moderator_id === modId && t.type === "payout");

    const totalEarned = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalPaid = payouts.reduce((sum, t) => sum + (t.amount || 0), 0);
    const walletBalance = Math.max(0, totalEarned - totalPaid);

    // Pending = credited but report might still be audited
    const pendingAmount = credits
      .filter((t) => {
        const dec = dbData.moderationDecisions.find((d) => d.id === t.decision_id);
        return dec && dec.audit_status === "pending";
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // 7-day activity
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activityByDay = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      activityByDay[d.toLocaleDateString("en-US", { weekday: "short" })] = 0;
    }
    decisions.forEach((d) => {
      const date = new Date(d.created_at);
      if (date >= sevenDaysAgo) {
        const label = date.toLocaleDateString("en-US", { weekday: "short" });
        if (label in activityByDay) activityByDay[label]++;
      }
    });

    // Audit results
    const audits = decisions.filter((d) => d.audit_status !== "pending");
    const auditCorrect = audits.filter((d) => d.audit_status === "correct").length;
    const auditIncorrect = audits.filter((d) => d.audit_status === "incorrect").length;

    // Today's reviews
    const today = new Date().toDateString();
    const todayDecisions = decisions.filter((d) => new Date(d.created_at).toDateString() === today);
    const todayEarnings = todayDecisions.reduce((sum, d) => sum + (d.reward_amount || 0), 0);

    // This week
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekDecisions = decisions.filter((d) => new Date(d.created_at) >= weekAgo);
    const weekEarnings = weekDecisions.reduce((sum, d) => sum + (d.reward_amount || 0), 0);

    const recentDecisions = decisions.slice(-15).reverse().map((d) => {
      const report = dbData.reports.find((r) => r.id === d.report_id);
      return {
        ...d,
        report_title: report ? report.title : d.report_id,
        report_category: report ? report.category : "general",
      };
    });

    const pendingTasks = (dbData.moderationTasks || []).filter(
      (t) => t.moderator_id === modId && t.status === "pending"
    ).length;

    return res.json({
      profile,
      stats: {
        totalReviews: decisions.length,
        totalEarned,
        totalPaid,
        walletBalance,
        pendingAmount,
        rewardPerReview: Number(getConfig("reward_per_approve")) || 5,
        approvals: profile?.approvals || 0,
        rejections: profile?.rejections || 0,
        escalations: profile?.escalations || 0,
        accuracy: profile?.accuracy || 100,
        trustScore: profile?.trust_score || 50,
        level: profile?.level || "trainee",
        pendingTasks,
        todayReviews: todayDecisions.length,
        todayEarnings,
        weekReviews: weekDecisions.length,
        weekEarnings,
        auditedCount: profile?.audited_count || 0,
        auditCorrect,
        auditIncorrect,
        activityByDay,
      },
      recentDecisions,
      payouts,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Wallet detail
router.get("/wallet", requireAuth, requireStudentModerator, (req, res) => {
  try {
    const modId = req.user.id;
    const dbData = readDb();

    if (!dbData.walletTransactions) dbData.walletTransactions = [];

    const transactions = dbData.walletTransactions
      .filter((t) => t.moderator_id === modId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const credits = transactions.filter((t) => t.type === "credit");
    const payouts = transactions.filter((t) => t.type === "payout");

    const totalEarned = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalPaid = payouts.reduce((sum, t) => sum + (t.amount || 0), 0);
    const available = Math.max(0, totalEarned - totalPaid);

    const pendingAmount = credits
      .filter((t) => {
        const dec = (dbData.moderationDecisions || []).find((d) => d.id === t.decision_id);
        return dec && dec.audit_status === "pending";
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return res.json({
      wallet: {
        total_earned: totalEarned,
        available,
        pending: pendingAmount,
        total_paid: totalPaid,
        reviews_completed: credits.length,
        rate_per_review: Number(getConfig("reward_per_approve")) || 5,
      },
      transactions,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Request payout
router.post("/payout", requireAuth, requireStudentModerator, (req, res) => {
  try {
    const { amount, upi_id } = req.body;
    if (!amount || Number(amount) <= 0 || !upi_id) {
      return res.status(400).json({ error: "Amount (> 0) and UPI ID are required" });
    }

    const modId = req.user.id;
    const dbData = readDb();
    if (!dbData.walletTransactions) dbData.walletTransactions = [];

    const credits = dbData.walletTransactions.filter((t) => t.moderator_id === modId && t.type === "credit");
    const payouts = dbData.walletTransactions.filter((t) => t.moderator_id === modId && t.type === "payout");

    const totalEarned = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalPaid = payouts.reduce((sum, t) => sum + (t.amount || 0), 0);
    const balance = Math.max(0, totalEarned - totalPaid);

    if (Number(amount) > balance) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ₹${balance.toFixed(2)}`,
      });
    }

    const payout = {
      id: uuidv4(),
      moderator_id: modId,
      decision_id: null,
      report_id: null,
      report_title: null,
      type: "payout",
      amount: Number(amount),
      payout_upi: upi_id,
      status: "completed",
      created_at: new Date().toISOString(),
    };

    dbData.walletTransactions.push(payout);
    writeDb(dbData);

    return res.json({
      success: true,
      payout,
      remaining_balance: balance - Number(amount),
      message: `₹${amount} payout initiated to ${upi_id} via UPI. Funds will arrive within 24 hours. [SIMULATED — Prototype Demo]`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Leaderboard (public)
router.get("/leaderboard", (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.moderatorProfiles) return res.json({ leaderboard: [] });

    const leaderboard = dbData.moderatorProfiles
      .filter((p) => p.status === "approved")
      .map((p) => {
        const user = (dbData.users || []).find((u) => u.id === p.user_id);
        const credits = (dbData.walletTransactions || []).filter(
          (t) => t.moderator_id === p.user_id && t.type === "credit"
        );
        const totalEarned = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
        return {
          id: p.user_id,
          name: user ? user.name : "Moderator",
          college: (dbData.moderatorApplications || []).find((a) => a.user_id === p.user_id)?.college || "",
          level: p.level,
          trust_score: p.trust_score,
          accuracy: p.accuracy,
          total_reviews: p.total_reviews,
          total_earned: totalEarned,
        };
      })
      .sort((a, b) => b.total_reviews - a.total_reviews)
      .slice(0, 10);

    return res.json({ leaderboard });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
