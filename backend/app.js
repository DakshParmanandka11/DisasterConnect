const express = require("express");
const cors = require("cors");
const path = require("path");

require("./db"); // Initialize DB file store

const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/reports");
const ngoRoutes = require("./routes/ngo");
const smsRoutes = require("./routes/sms");
const moderatorRoutes = require("./routes/moderator");
const { getConfig } = require("./db");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ngo", ngoRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/moderator", moderatorRoutes);

app.get("/api/config", (req, res) => {
  res.json({
    voting_radius_km: getConfig("voting_radius_km"),
    verification_threshold_pct: getConfig("verification_threshold_pct"),
    min_vote_quorum: getConfig("min_vote_quorum"),
    ngo_notify_radius_km: getConfig("ngo_notify_radius_km"),
    duplicate_cluster_radius_km: getConfig("duplicate_cluster_radius_km"),
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

module.exports = app;
