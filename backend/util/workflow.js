// Server-side verification + NGO notification logic. All decisions are recomputed from stored vote records.
const { v4: uuidv4 } = require("uuid");
const { getConfig } = require("../db");
const { distanceKm } = require("./geo");

const PUBLISHED = ["APPROVED_BY_MODERATOR", "APPROVED_BY_SENIOR", "COMMUNITY_VERIFIED", "NGO_DISPATCHED"];
const VOTABLE = ["APPROVED_BY_MODERATOR", "APPROVED_BY_SENIOR", "COMMUNITY_VERIFIED"];
const RESPONSE_ORDER = ["new", "acknowledged", "responding", "resolved"];

/** Recompute tallies from stored votes. Remote ("signal") votes never count toward verification. */
function tally(dbData, reportId) {
  const local = (dbData.votes || []).filter((v) => v.report_id === reportId && v.vote_tier === "local");
  const remote = (dbData.votes || []).filter((v) => v.report_id === reportId && v.vote_tier === "remote");
  const up = local.filter((v) => v.vote_type === "up").length;
  const down = local.filter((v) => v.vote_type === "down").length;
  const total = up + down;
  return { up, down, total, remote: remote.length, upPct: total ? Math.round((up / total) * 1000) / 10 : 0 };
}

function verificationParams() {
  return {
    quorum: getConfig("min_vote_quorum") || 10,
    thresholdPct: getConfig("verification_threshold_pct") || 40,
    radiusKm: getConfig("voting_radius_km") || 10,
  };
}

function ngoResponseStatus(n) {
  return n.response_status || (n.status === "acknowledged" ? "acknowledged" : "new");
}

/** Create one in-app notification per eligible approved NGO, at most once per (ngo, report). */
function notifyNgos(dbData, report) {
  if (!dbData.notifications) dbData.notifications = [];
  const created = [];
  const notifyDefault = getConfig("ngo_notify_radius_km") || 25;
  for (const ngo of dbData.ngo_profiles || []) {
    if (ngo.verification_status !== "approved") continue;
    if (ngo.service_lat == null || ngo.service_lng == null) continue;
    const radius = Number(ngo.service_radius_km) || notifyDefault;
    const d = distanceKm(Number(ngo.service_lat), Number(ngo.service_lng), report.lat, report.lng);
    if (d > radius) continue;
    if (dbData.notifications.some((n) => n.ngo_id === ngo.id && n.report_id === report.id)) continue; // idempotent
    const now = new Date().toISOString();
    const n = {
      id: uuidv4(),
      ngo_id: ngo.id,
      report_id: report.id,
      created_at: now,
      distance_km: Math.round(d * 10) / 10,
      // Delivery is tracked separately from the NGO's response.
      delivery_channel: "in_app",
      delivery_status: "available_in_dashboard", // true as soon as it is stored; no SMS/email is sent
      response_status: "new",
      acknowledged_at: null,
      response_updated_at: null,
      response_note: "",
      history: [{ at: now, event: "created", status: "new" }],
    };
    dbData.notifications.push(n);
    created.push(n);
  }
  return created;
}

/** Aggregate NGO response onto the report so the feed/map can show it consistently. */
function syncReportResponse(dbData, report) {
  const ns = (dbData.notifications || []).filter((n) => n.report_id === report.id);
  if (!ns.length) { report.response_status = null; return; }
  const statuses = ns.map(ngoResponseStatus);
  if (statuses.every((s) => s === "resolved")) report.response_status = "resolved";
  else if (statuses.some((s) => s === "responding")) report.response_status = "responding";
  else if (statuses.some((s) => s === "acknowledged" || s === "resolved")) report.response_status = "acknowledged";
  else report.response_status = "new";
  report.response_updated_at = new Date().toISOString();
}

/**
 * Apply the verification rule from stored votes. Idempotent: only transitions
 * published → COMMUNITY_VERIFIED once, and only then notifies NGOs.
 * Returns { transitioned, notified }.
 */
function evaluateVerification(dbData, report) {
  const t = tally(dbData, report.id);
  report.upvotes = t.up; report.downvotes = t.down; report.remote_votes = t.remote;
  const { quorum, thresholdPct } = verificationParams();
  let transitioned = false;
  let notified = [];
  if (["APPROVED_BY_MODERATOR", "APPROVED_BY_SENIOR"].includes(report.moderation_status) && t.total >= quorum && t.upPct >= thresholdPct) {
    report.moderation_status = "COMMUNITY_VERIFIED";
    report.status = "flagged"; // legacy field the UI still reads
    report.verified_at = new Date().toISOString();
    transitioned = true;
    notified = notifyNgos(dbData, report);
  }
  return { transitioned, notified, tally: t, quorum, thresholdPct };
}

module.exports = { PUBLISHED, VOTABLE, RESPONSE_ORDER, tally, verificationParams, notifyNgos, evaluateVerification, ngoResponseStatus, syncReportResponse };
