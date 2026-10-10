require("dotenv").config();
const app = require("./app");
const path = require("path");
const express = require("express");

// Serve static frontend build files in production mode when run directly
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`DisasterConnect API running cleanly on http://localhost:${PORT}`);
});
