const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DB_FILE = (process.env.VERCEL || process.env.NODE_ENV === "production")
  ? path.join("/tmp", "disasterconnect_data.json")
  : path.join(__dirname, "data.json");

// Initial seed data if data.json does not exist
const initialData = {
  users: [
    {
      id: "guest-citizen-anon-id",
      name: "Local Citizen",
      email: "guest_citizen@disasterconnect.local",
      password_hash: "guest_hash",
      role: "citizen",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-moderator-id",
      name: "Aarav Sharma (Student Mod)",
      email: "student_mod@disasterconnect.org",
      password_hash: bcrypt.hashSync("modpass123", 4),
      role: "moderator",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-ngo-1",
      name: "National Disaster Relief Corps (NDRC)",
      email: "ndrc-relief@disasterconnect.org",
      password_hash: bcrypt.hashSync("ngo-pass-123", 4),
      role: "ngo",
      home_lat: 28.6139,
      home_lng: 77.209,
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
  reports: [
    {
      id: "sample-report-1",
      user_id: "guest-citizen-anon-id",
      title: "Severe Urban Flooding & Waterlogging",
      description: "Water levels reached 3 feet near main arterial road. Vehicles stranded and emergency rescue required.",
      category: "flood",
      severity: "high",
      lat: 28.6139,
      lng: 77.209,
      status: "pending",
      moderation_status: "approved",
      relevance_score: 95,
      gibberish_score: 0,
      upvotes: 8,
      downvotes: 1,
      remote_votes: 3,
      exif_status: "verified",
      confirmations: 1,
      created_at: new Date().toISOString(),
    },
  ],
  media: [],
  votes: [],
  notifications: [],
  moderator_reviews: [],
  moderator_payouts: [],
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

function readDb() {
  if (memoryDb) return memoryDb;
  try {
    if (!fs.existsSync(DB_FILE)) {
      memoryDb = JSON.parse(JSON.stringify(initialData));
      writeDb(memoryDb);
      return memoryDb;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    memoryDb = JSON.parse(raw);
    return memoryDb;
  } catch (err) {
    console.error("Error reading data.json, resetting to initial:", err.message);
    memoryDb = JSON.parse(JSON.stringify(initialData));
    writeDb(memoryDb);
    return memoryDb;
  }
}

function writeDb(data) {
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving data.json:", err.message);
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
