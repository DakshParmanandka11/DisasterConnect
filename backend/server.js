const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

require("./db"); // initializes schema + defaults

const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/reports");
const ngoRoutes = require("./routes/ngo");
const smsRoutes = require("./routes/sms");
const { getConfig } = require("./db");
const realtime = require("./realtime");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ngo", ngoRoutes);
app.use("/api/sms", smsRoutes);

app.get("/api/config", (req, res) => {
  res.json({
    voting_radius_km: getConfig("voting_radius_km"),
    verification_threshold_pct: getConfig("verification_threshold_pct"),
    min_vote_quorum: getConfig("min_vote_quorum"),
    ngo_notify_radius_km: getConfig("ngo_notify_radius_km"),
    duplicate_cluster_radius_km: getConfig("duplicate_cluster_radius_km"),
  });
});

// Serve built frontend in production
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });
realtime.setIO(io);
io.on("connection", () => {});

const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => console.log(`DisasterConnect API (+ realtime) running on 0.0.0.0:${PORT}`));

