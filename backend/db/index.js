const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "disasterconnect.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen', -- citizen | ngo | admin
  home_lat REAL,
  home_lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ngo_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  org_name TEXT NOT NULL,
  service_lat REAL NOT NULL,
  service_lng REAL NOT NULL,
  service_radius_km REAL NOT NULL DEFAULT 25,
  verification_status TEXT NOT NULL DEFAULT 'approved', -- pending | approved | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | flagged | under_review | resolved
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  flagged_at TEXT,
  cluster_id TEXT, -- groups likely-duplicate reports of the same real-world incident
  confirmations INTEGER NOT NULL DEFAULT 1, -- how many separate reports describe this same incident
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- image | video
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  vote_type TEXT NOT NULL, -- up | down
  voter_lat REAL NOT NULL,
  voter_lng REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  ngo_id TEXT NOT NULL REFERENCES ngo_profiles(id),
  status TEXT NOT NULL DEFAULT 'sent', -- sent | acknowledged
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Migration safety for existing SQLite DB files
try {
  db.exec("ALTER TABLE reports ADD COLUMN cluster_id TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN confirmations INTEGER NOT NULL DEFAULT 1;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN exif_status TEXT DEFAULT 'missing';");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN exif_lat REAL;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN exif_lng REAL;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN exif_timestamp TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN remote_votes INTEGER NOT NULL DEFAULT 0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reports ADD COLUMN spatial_density_score INTEGER NOT NULL DEFAULT 1;");
} catch (e) {}
try {
  db.exec("ALTER TABLE votes ADD COLUMN vote_tier TEXT DEFAULT 'local';");
} catch (e) {}

const defaults = {
  voting_radius_km: "10",
  verification_threshold_pct: "40",
  min_vote_quorum: "10",
  ngo_notify_radius_km: "25",
  duplicate_cluster_radius_km: "0.5",
  duplicate_cluster_window_hours: "6",
  spatial_density_count_threshold: "3",
  spatial_density_window_min: "30",
  spatial_density_radius_km: "2.0",
};
const insertConfig = db.prepare(
  "INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)"
);
for (const [k, v] of Object.entries(defaults)) insertConfig.run(k, v);

function getConfig(key) {
  const row = db.prepare("SELECT value FROM system_config WHERE key = ?").get(key);
  return row ? Number(row.value) : null;
}

module.exports = { db, getConfig };
