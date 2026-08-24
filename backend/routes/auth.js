const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { db } = require("../db");
const { signToken, requireAuth } = require("../util/auth");

const router = express.Router();

// Register — role: citizen | ngo
router.post("/register", (req, res) => {
  const { name, email, password, role, home_lat, home_lng, org_name, service_radius_km } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const finalRole = role === "ngo" ? "ngo" : "citizen";

  if (finalRole === "ngo") {
    if (home_lat == null || home_lng == null || !org_name) {
      return res.status(400).json({
        error: "org_name, home_lat, and home_lng are required to register an NGO account",
      });
    }
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, home_lat, home_lng)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, email, hash, finalRole, home_lat ?? null, home_lng ?? null);

  if (finalRole === "ngo") {
    db.prepare(
      `INSERT INTO ngo_profiles (id, user_id, org_name, service_lat, service_lng, service_radius_km)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), id, org_name, home_lat, home_lng, service_radius_km || 25);
  }

  const user = { id, name, role: finalRole };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role },
  });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, role, home_lat, home_lng FROM users WHERE id = ?")
    .get(req.user.id);
  res.json({ user });
});

module.exports = router;
