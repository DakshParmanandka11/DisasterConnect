const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../db");
const { signToken, requireAuth } = require("../util/auth");

const router = express.Router();

router.post("/register", (req, res) => {
  const { name, email, password, role, home_lat, home_lng, org_name, service_radius_km } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }

  const dbData = readDb();
  const existing = dbData.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const finalRole = role === "ngo" ? "ngo" : role === "moderator" ? "moderator" : "citizen";

  if (finalRole === "ngo" && (!home_lat || !home_lng || !org_name)) {
    return res.status(400).json({ error: "org_name, home_lat, and home_lng are required for NGO accounts" });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);

  const newUser = {
    id,
    name,
    email,
    password_hash: hash,
    role: finalRole,
    home_lat: home_lat ?? null,
    home_lng: home_lng ?? null,
    created_at: new Date().toISOString(),
  };
  dbData.users.push(newUser);

  if (finalRole === "ngo") {
    dbData.ngo_profiles.push({
      id: uuidv4(),
      user_id: id,
      org_name,
      service_lat: home_lat,
      service_lng: home_lng,
      service_radius_km: service_radius_km || 25,
      verification_status: "approved",
      upi_id: "relief-ngo@upi",
      contact_phone: "+91-9876543210",
      contact_email: email,
      focus_areas: "Flood Relief, Emergency Rescue & Medical Aid",
      created_at: new Date().toISOString(),
    });
  }

  writeDb(dbData);

  const user = { id, name, role: finalRole };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const dbData = readDb();
  const user = dbData.users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());

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
  const dbData = readDb();
  const user = dbData.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      home_lat: user.home_lat,
      home_lng: user.home_lng,
    },
  });
});

module.exports = router;
