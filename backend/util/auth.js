const jwt = require("jsonwebtoken");
const { readDb, writeDb } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "disasterconnect-dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (e) {
      // Invalid/expired token — fallback to guest citizen
    }
  }

  const dbData = readDb();
  let guestUser = dbData.users.find((u) => u.email === "guest_citizen@disasterconnect.local");

  if (!guestUser) {
    guestUser = {
      id: "guest-citizen-anon-id",
      name: "Local Citizen",
      email: "guest_citizen@disasterconnect.local",
      password_hash: "guest_hash",
      role: "citizen",
      created_at: new Date().toISOString(),
    };
    dbData.users.push(guestUser);
    writeDb(dbData);
  }

  req.user = { id: guestUser.id, role: guestUser.role, name: guestUser.name };
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };
