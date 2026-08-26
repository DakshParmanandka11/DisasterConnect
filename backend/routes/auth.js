const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../db");
const { signToken, requireAuth } = require("../util/auth");

const router = express.Router();

router.post("/register", (req, res) => {
  try {
    const { name, email, password, role, home_lat, home_lng, org_name, service_radius_km } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    const dbData = readDb();
    if (!dbData.users) dbData.users = [];
    if (!dbData.ngo_profiles) dbData.ngo_profiles = [];

    // Strict duplicate email check
    const existing = dbData.users.find((u) => u && u.email && String(u.email).trim().toLowerCase() === normalizedEmail);

    if (existing) {
      return res.status(409).json({ error: "An account with this email address already exists. Please log in instead." });
    }

    const finalRole = role === "ngo" ? "ngo" : role === "moderator" ? "moderator" : "citizen";

    if (finalRole === "ngo" && (!home_lat || !home_lng || !org_name)) {
      return res.status(400).json({ error: "Organisation name and location on map are required for NGO accounts" });
    }

    const id = uuidv4();
    const hash = bcrypt.hashSync(String(password), 8);

    const newUser = {
      id,
      name: String(name).trim(),
      email: normalizedEmail,
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
        org_name: String(org_name).trim(),
        service_lat: home_lat,
        service_lng: home_lng,
        service_radius_km: Number(service_radius_km) || 25,
        verification_status: "approved",
        upi_id: "relief-ngo@upi",
        contact_phone: "+91-9876543210",
        contact_email: normalizedEmail,
        focus_areas: "Flood Relief, Emergency Rescue & Medical Aid",
        created_at: new Date().toISOString(),
      });
    }

    writeDb(dbData);

    const userObj = { id, name: newUser.name, email: normalizedEmail, role: finalRole };
    const token = signToken(userObj);
    return res.status(201).json({ token, user: userObj });
  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ error: err.message || "Registration failed on server" });
  }
});

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const dbData = readDb();
    if (!dbData.users) dbData.users = [];

    const user = dbData.users.find((u) => u && u.email && String(u.email).trim().toLowerCase() === normalizedEmail);

    if (!user || !user.password_hash || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password. Please check your credentials." });
    }

    const userObj = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = signToken(userObj);
    return res.json({
      token,
      user: userObj,
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: err.message || "Login failed on server" });
  }
});

router.get("/me", requireAuth, (req, res) => {
  try {
    const dbData = readDb();
    if (!dbData.users) dbData.users = [];

    const user = dbData.users.find((u) => u && u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        home_lat: user.home_lat,
        home_lng: user.home_lng,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch profile" });
  }
});

module.exports = router;
