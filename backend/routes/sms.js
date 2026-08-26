const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../db");
const { distanceKm } = require("../util/geo");

const router = express.Router();

const CATEGORY_MAP = {
  flood: ["flood", "water", "drowning", "overflow", "inundation", "deluge"],
  fire: ["fire", "burn", "blaze", "smoke", "flame", "wildfire"],
  earthquake: ["earthquake", "quake", "tremor", "seismic"],
  tsunami: ["tsunami", "cyclone", "hurricane", "typhoon", "storm"],
  landslide: ["landslide", "mudslide", "avalanche", "slide"],
  building_collapse: ["collapse", "rubble", "structural", "collapsed"],
};

const SEVERITY_MAP = {
  critical: ["critical", "urgent", "emergency", "trapped", "dying", "help", "sos", "save"],
  high: ["high", "bad", "serious", "severe", "dangerous"],
  moderate: ["moderate", "medium"],
};

function parseCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return "flood";
}

function parseSeverity(text) {
  const lower = text.toLowerCase();
  for (const [sev, keywords] of Object.entries(SEVERITY_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return sev;
  }
  return "high";
}

function parseCoords(text) {
  const coordMatch = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  }
  return null;
}

router.post("/incoming", (req, res) => {
  const { from, body: smsBody } = req.body;
  if (!smsBody) return res.status(400).json({ error: "SMS body required" });

  const text = smsBody.trim();
  const lower = text.toLowerCase();
  const parts = text.split("|").map((p) => p.trim());

  let category, severity, coords, note, title;

  if (parts.length >= 4) {
    category = parseCategory(parts[1] || "");
    severity = parseSeverity(parts[2] || "high");
    coords = parseCoords(parts[3] || "");
    note = parts[4] || "SMS emergency dispatch";
    title = `SMS Emergency: ${(parts[1] || "UNKNOWN").toUpperCase()}`;
  } else {
    category = parseCategory(text);
    severity = parseSeverity(text);
    coords = parseCoords(text);
    note = text;
    title = lower.includes("sos") || lower.includes("help") ? "SOS Emergency Distress Signal" : `SMS Alert: ${text.slice(0, 40)}`;
  }

  const dbData = readDb();
  let botUser = dbData.users.find((u) => u.email === "sms-gateway@disasterconnect.system");
  if (!botUser) {
    botUser = {
      id: uuidv4(),
      name: "SMS Gateway Bot",
      email: "sms-gateway@disasterconnect.system",
      password_hash: "bot-no-login",
      role: "citizen",
      created_at: new Date().toISOString(),
    };
    dbData.users.push(botUser);
  }

  const reportLat = coords ? coords.lat : 20.5937;
  const reportLng = coords ? coords.lng : 78.9629;
  const reportId = uuidv4();

  dbData.reports.unshift({
    id: reportId,
    user_id: botUser.id,
    title,
    description: `Via SMS from ${from || "Unknown"}. Message: ${note}`,
    category,
    severity,
    lat: reportLat,
    lng: reportLng,
    status: "flagged",
    moderation_status: "approved",
    relevance_score: 90,
    gibberish_score: 0,
    upvotes: 1,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    created_at: new Date().toISOString(),
  });

  writeDb(dbData);

  res.json({
    success: true,
    reportId,
    reply: `Emergency received. Report #${reportId.slice(0, 8)} created. Stay safe.`,
  });
});

module.exports = router;
