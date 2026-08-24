const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { db } = require("../db");
const { distanceKm } = require("../util/geo");
const realtime = require("../realtime");

const router = express.Router();

// Category keyword mapping
const CATEGORY_MAP = {
  flood: ["flood", "water", "drowning", "overflow", "inundation"],
  fire: ["fire", "burn", "blaze", "smoke", "flame"],
  earthquake: ["earthquake", "quake", "tremor", "collapse", "rubble"],
  medical: ["medical", "injured", "injury", "hurt", "ambulance", "hospital", "bleeding", "unconscious"],
  landslide: ["landslide", "mudslide", "slide", "debris"],
  cyclone: ["cyclone", "hurricane", "storm", "wind", "typhoon"],
};

const SEVERITY_MAP = {
  critical: ["critical", "urgent", "emergency", "trapped", "dying", "help", "sos", "save", "critical"],
  high: ["high", "bad", "serious", "severe", "dangerous"],
  moderate: ["moderate", "medium"],
  low: ["low", "minor", "small"],
};

function parseCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return "flood"; // default for SOS/HELP without category
}

function parseSeverity(text) {
  const lower = text.toLowerCase();
  for (const [sev, keywords] of Object.entries(SEVERITY_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return sev;
  }
  return "high"; // default for emergency texts
}

function parseCoords(text) {
  // Match patterns like: 28.6139,77.2090 or 28.6139, 77.2090
  const coordMatch = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  }
  return null;
}

function notifyNearbyNGOs(reportId, reportLat, reportLng) {
  try {
    const radius = 25;
    const ngos = db
      .prepare("SELECT np.*, u.name, u.email FROM ngo_profiles np JOIN users u ON u.id = np.user_id WHERE np.verification_status = 'approved'")
      .all();
    const nearby = ngos.filter((n) => distanceKm(reportLat, reportLng, n.service_lat, n.service_lng) <= Math.max(n.service_radius_km, radius));
    if (nearby.length > 0) {
      realtime.emit("ngo:alert", {
        reportId,
        message: `🚨 SMS Emergency Report at (${reportLat.toFixed(4)}, ${reportLng.toFixed(4)}) — Dispatched to ${nearby.length} NGO(s)`,
        nearbyNgoIds: nearby.map((n) => n.user_id),
      });
    }
  } catch (e) {}
}

/**
 * POST /api/sms/incoming
 * Simulated SMS Gateway Webhook
 * Body: { from: "+91XXXXXXXXXX", body: "SOS|FLOOD|CRITICAL|28.61,77.20|Trapped on roof" }
 *       OR simple: { from: "+91XXXXXXXXXX", body: "SOS" }
 *       OR: { from: "+91XXXXXXXXXX", body: "HELP" }
 */
router.post("/incoming", (req, res) => {
  const { from, body: smsBody } = req.body;

  if (!smsBody) return res.status(400).json({ error: "SMS body required" });

  const text = smsBody.trim();
  const lower = text.toLowerCase();

  // Detect if it's a pipe-delimited structured payload: SOS|FLOOD|CRITICAL|LAT,LNG|NOTE
  const parts = text.split("|").map((p) => p.trim());
  let category, severity, coords, note, title;

  if (parts.length >= 4) {
    // Structured SMS: ALERT|FLOOD|HIGH|28.61,77.20|Trapped on roof
    category = parseCategory(parts[1] || "");
    severity = parseSeverity(parts[2] || "high");
    coords = parseCoords(parts[3] || "");
    note = parts[4] || "SMS emergency dispatch";
    title = `SMS Emergency: ${(parts[1] || "UNKNOWN").toUpperCase()}`;
  } else {
    // Unstructured SOS/HELP
    category = parseCategory(text);
    severity = parseSeverity(text);
    coords = parseCoords(text);
    note = text;
    title = lower.includes("sos") || lower.includes("help") ? "SOS Emergency Distress Signal" : `SMS Alert: ${text.slice(0, 40)}`;
  }

  // Find or create a bot user for SMS-originated reports
  let botUser = db.prepare("SELECT id FROM users WHERE email = 'sms-gateway@disasterconnect.system'").get();
  if (!botUser) {
    const botId = uuidv4();
    db.prepare("INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(
      botId, "SMS Gateway Bot", "sms-gateway@disasterconnect.system", "bot-no-login", "citizen"
    );
    botUser = { id: botId };
  }

  // Use default coords (center of India) if no GPS in SMS
  const reportLat = coords ? coords.lat : 20.5937;
  const reportLng = coords ? coords.lng : 78.9629;

  const reportId = uuidv4();
  db.prepare(
    `INSERT INTO reports (id, user_id, title, description, category, severity, lat, lng, status, exif_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'flagged', 'missing')`
  ).run(reportId, botUser.id, title, `Via SMS from ${from || "Unknown"}. Message: ${note}`, category, severity, reportLat, reportLng);

  // Immediately notify nearby NGOs
  notifyNearbyNGOs(reportId, reportLat, reportLng);
  realtime.emit("report:new", {
    id: reportId, title, category, severity, lat: reportLat, lng: reportLng,
    status: "flagged", description: note, source: "sms",
  });

  console.log(`[SMS Gateway] New report from ${from}: ${title} at (${reportLat}, ${reportLng})`);

  // Response for SMS gateway (if bidirectional)
  res.json({
    success: true,
    reportId,
    reply: `✅ Emergency received. Report #${reportId.slice(0, 8)} created. Rescue teams alerted. Stay safe.`,
  });
});

/**
 * POST /api/sms/bot
 * Interactive SMS Bot — simulates multi-step dialog
 * Body: { from: "+91XXXXXXXXXX", body: "1" (reply to menu), sessionId: "..." }
 */
const smsSessionStore = new Map(); // In-memory session store

router.post("/bot", (req, res) => {
  const { from, body: smsBody } = req.body;
  const text = (smsBody || "").trim().toLowerCase();
  const sessionKey = from || "unknown";

  const session = smsSessionStore.get(sessionKey) || { step: "initial" };

  let reply = "";

  if (session.step === "initial" || text === "sos" || text === "help") {
    smsSessionStore.set(sessionKey, { step: "awaiting_category" });
    reply = "🆘 DISASTERCONNECT EMERGENCY BOT\nReply with your situation:\n1 = Flood\n2 = Fire\n3 = Medical\n4 = Earthquake\n5 = Other";
  } else if (session.step === "awaiting_category") {
    const categoryChoice = { "1": "flood", "2": "fire", "3": "medical", "4": "earthquake", "5": "other" }[text] || "flood";
    smsSessionStore.set(sessionKey, { step: "awaiting_severity", category: categoryChoice });
    reply = `Got it: ${categoryChoice.toUpperCase()}. How severe?\n1 = Critical (life at risk)\n2 = High\n3 = Moderate`;
  } else if (session.step === "awaiting_severity") {
    const sevChoice = { "1": "critical", "2": "high", "3": "moderate" }[text] || "high";
    const { category } = session;
    smsSessionStore.set(sessionKey, { step: "done" });

    // Create the emergency report
    const botUser = db.prepare("SELECT id FROM users WHERE email = 'sms-gateway@disasterconnect.system'").get();
    const userId = botUser ? botUser.id : uuidv4();
    const reportId = uuidv4();
    db.prepare(
      `INSERT INTO reports (id, user_id, title, description, category, severity, lat, lng, status, exif_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'flagged', 'missing')`
    ).run(reportId, userId, `SMS Bot: ${category} emergency`, `Interactive SMS bot report from ${from}`, category, sevChoice, 20.5937, 78.9629);
    notifyNearbyNGOs(reportId, 20.5937, 78.9629);
    realtime.emit("report:new", { id: reportId, title: `SMS: ${category}`, category, severity: sevChoice, source: "sms_bot" });

    smsSessionStore.delete(sessionKey);
    reply = `✅ Report created. #${reportId.slice(0, 8)}\nEmergency services alerted.\nStay in a safe location & wait for help.`;
  } else {
    smsSessionStore.delete(sessionKey);
    reply = "Text SOS or HELP to start emergency alert.";
  }

  res.json({ success: true, reply });
});

/**
 * GET /api/sms/pending-reports
 * Returns all SMS-originated reports
 */
router.get("/pending-reports", (req, res) => {
  const botUser = db.prepare("SELECT id FROM users WHERE email = 'sms-gateway@disasterconnect.system'").get();
  if (!botUser) return res.json([]);
  const reports = db.prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(botUser.id);
  res.json(reports);
});

module.exports = router;
