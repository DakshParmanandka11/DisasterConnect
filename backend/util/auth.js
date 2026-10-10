const jwt = require("jsonwebtoken");
const { readDb, writeDb } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "disasterconnect-dev-secret-change-me";
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyBearer(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Strict: a valid token is required. No guest fallback.
function requireAuth(req, res, next) {
  const user = verifyBearer(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  req.user = user;
  next();
}

// Lenient: used only where anonymous submission/reading is intended
// (posting a report, viewing a published report). Falls back to the guest citizen.
function optionalAuth(req, res, next) {
  const user = verifyBearer(req);
  if (user) {
    req.user = user;
    return next();
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

module.exports = { signToken, requireAuth, optionalAuth, requireRole, JWT_SECRET };
