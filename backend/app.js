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
const { getConfig } = require("./db");

const app = express();
app.use(cors());
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
  res.status(500).json({ error: err.message || "Internal server error" });
});

module.exports = app;
