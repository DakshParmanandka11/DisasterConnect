require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

require("./db"); // Initialize DB file store

const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/reports");
const ngoRoutes = require("./routes/ngo");
const moderatorRoutes = require("./routes/moderator");
const adminRoutes = require("./routes/admin");
const intelligenceRoutes = require("./routes/intelligence");
const { getConfig } = require("./db");

const app = express();
// CORS: same-origin requests need none. Allow local dev + origins listed in CORS_ORIGINS (comma-separated).
const allowedOrigins = new Set(
  ["http://localhost:5173", "http://127.0.0.1:5173", ...(process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)]
);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
}));

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not set; using an insecure default. Set it before deploying.");
}

// Small in-memory limiter for credential endpoints (per IP, per minute).
const authHits = new Map();
app.use("/api/auth/login", (req, res, next) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const hits = (authHits.get(ip) || []).filter((t) => now - t < 60000);
  if (hits.length >= 10) return res.status(429).json({ error: "Too many login attempts. Try again in a minute." });
  hits.push(now);
  authHits.set(ip, hits);
  next();
});
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Normalize URL for Vercel Serverless Function invocations
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ngo", ngoRoutes);
app.use("/api/moderator", moderatorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/intelligence", intelligenceRoutes);

app.get("/api/config", (req, res) => {
  try {
    return res.json({
      voting_radius_km: getConfig("voting_radius_km") || 10,
      verification_threshold_pct: getConfig("verification_threshold_pct") || 40,
      min_vote_quorum: getConfig("min_vote_quorum") || 10,
      ngo_notify_radius_km: getConfig("ngo_notify_radius_km") || 25,
      duplicate_cluster_radius_km: getConfig("duplicate_cluster_radius_km") || 0.5,
    });
  } catch (e) {
    return res.json({
      voting_radius_km: 10,
      verification_threshold_pct: 40,
      min_vote_quorum: 10,
      ngo_notify_radius_km: 25,
      duplicate_cluster_radius_km: 0.5,
    });
  }
});

app.use((err, req, res, next) => {
  console.error("Express Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
