const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DB_FILE = process.env.DC_DB_FILE
  ? process.env.DC_DB_FILE
  : (process.env.VERCEL || process.env.NODE_ENV === "production")
    ? path.join("/tmp", "disasterconnect_data.json")
    : path.join(__dirname, "data.json");

const CLOUD_DB_URL = process.env.CLOUD_DB_URL || process.env.MONGODB_URI || null;

const initialData = {
  users: [
    {
      id: "guest-citizen-anon-id",
      name: "Local Citizen",
      email: "guest_citizen@disasterconnect.local",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "citizen",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-admin-id",
      name: "Admin",
      email: "admin@disasterconnect.org",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "admin",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-moderator-id",
      name: "Aarav Sharma",
      email: "student_mod@disasterconnect.org",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "student_moderator",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-mod-2-id",
      name: "Priya Nair",
      email: "priya.mod@disasterconnect.org",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "student_moderator",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-senior-mod-id",
      name: "Dr. Kavitha Menon",
      email: "senior.mod@disasterconnect.org",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "senior_moderator",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-ngo-1",
      name: "National Disaster Relief Corps (NDRC)",
      email: "ndrc-relief@disasterconnect.org",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "ngo",
      home_lat: 28.6139,
      home_lng: 77.209,
      created_at: new Date().toISOString(),
    },
    {
      id: "citizen-reporter-1",
      name: "Rahul Gupta",
      email: "rahul.citizen@example.com",
      password_hash: "$2a$10$WrglY5nmGYUahZ.tGs82gOU73WIlYmtp4T7T7Cj27qxGMXor2oT/i",
      role: "citizen",
      home_lat: 28.62,
      home_lng: 77.21,
      created_at: new Date().toISOString(),
    },
  ],
  ngo_profiles: [
    {
      id: "ngo-prof-1",
      user_id: "demo-ngo-1",
      org_name: "National Disaster Relief Corps",
      service_lat: 28.6139,
      service_lng: 77.209,
      service_radius_km: 50,
      verification_status: "approved",
      upi_id: "ndrc.disaster.relief@upi",
      contact_phone: "+91-9810011223",
      contact_email: "ndrc-relief@disasterconnect.org",
      focus_areas: "Flood Inundation, Emergency Evacuation & Food Relief",
      created_at: new Date().toISOString(),
    },
  ],
  reports: [],
  media: [],
  votes: [],
  notifications: [],
  moderatorApplications: [],
  moderatorProfiles: [],
  trainingAttempts: [],
  moderationTasks: [],
  moderationDecisions: [],
  moderatorAudits: [],
  walletTransactions: [],
  system_config: {
    voting_radius_km: "10",
    verification_threshold_pct: "40",
    min_vote_quorum: "10",
    ngo_notify_radius_km: "25",
    duplicate_cluster_radius_km: "0.5",
    duplicate_cluster_window_hours: "6",
    spatial_density_count_threshold: "3",
    spatial_density_window_min: "30",
    spatial_density_radius_km: "2.0",
  },
};

let memoryDb = null;
let cloudSyncing = false;

const SEED_FILE = path.join(__dirname, "data.json");

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      memoryDb = JSON.parse(raw);
      return memoryDb;
    }
  } catch (err) {
    console.error("Error reading DB_FILE:", err.message);
  }
  if (memoryDb) return memoryDb;

  // Load from seed data.json (which contains all users, tasks, applications, and password hashes)
  try {
    if (fs.existsSync(SEED_FILE)) {
      const seedRaw = fs.readFileSync(SEED_FILE, "utf-8");
      memoryDb = JSON.parse(seedRaw);
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
      } catch (e) {}
      return memoryDb;
    }
  } catch (e) {
    console.error("Error reading SEED_FILE:", e.message);
  }

  memoryDb = JSON.parse(JSON.stringify(initialData));
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
  } catch (e) {
    /* write error ignored on read-only filesystem */
  }
  return memoryDb;
}

function writeDb(data) {
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving DB file:", err.message);
  }

  // Asynchronously sync to Cloud Database if CLOUD_DB_URL / MONGODB_URI is provided
  if (CLOUD_DB_URL && !cloudSyncing) {
    cloudSyncing = true;
    Promise.resolve().then(async () => {
      try {
        await fetch(CLOUD_DB_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch (e) {
        console.error("Cloud DB write sync error:", e.message);
      } finally {
        cloudSyncing = false;
      }
    });
  }
}

function getConfig(key) {
  const dbData = readDb();
  const val = dbData.system_config?.[key];
  return val != null ? Number(val) : null;
}

module.exports = {
  readDb,
  writeDb,
  getConfig,
};
