const fs = require("fs");
const path = require("path");
const https = require("https");

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(__dirname, "db", "data.json");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const IMAGES = [
  {
    filename: "flood_lajpat.jpg",
    url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "storm_nh48.jpg",
    url: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "fire_okhla.jpg",
    url: "https://images.unsplash.com/photo-1565689157206-0fddef7589a2?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "gibberish_random.jpg",
    url: "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "red_nike_shoes.jpg",
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "flood_duplicate.jpg",
    url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "dam_breach_suspicious.jpg",
    url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "building_collapse.jpg",
    url: "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "ito_flooding.jpg",
    url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=800&auto=format&fit=crop",
  },
  {
    filename: "landslide_shimla.jpg",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop",
  },
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log("Downloading calamity demo images to backend/uploads...");
  for (const img of IMAGES) {
    const dest = path.join(UPLOADS_DIR, img.filename);
    try {
      await downloadFile(img.url, dest);
      console.log(`✓ Downloaded ${img.filename}`);
    } catch (e) {
      console.error(`✕ Error downloading ${img.filename}:`, e.message);
    }
  }

  // Now update media entries in data.json
  const dataRaw = fs.readFileSync(DATA_FILE, "utf-8");
  const db = JSON.parse(dataRaw);

  db.media = [
    {
      id: "media-flood-1",
      report_id: "report-flood-pending",
      file_path: "/uploads/flood_lajpat.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-storm-1",
      report_id: "report-road-approved",
      file_path: "/uploads/storm_nh48.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-fire-1",
      report_id: "report-fire-community-verified",
      file_path: "/uploads/fire_okhla.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-gibberish-1",
      report_id: "report-gibberish-rejected",
      file_path: "/uploads/gibberish_random.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-nike-1",
      report_id: "report-irrelevant-rejected",
      file_path: "/uploads/red_nike_shoes.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-duplicate-1",
      report_id: "report-duplicate-rejected",
      file_path: "/uploads/flood_duplicate.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-dam-1",
      report_id: "report-suspicious-escalated",
      file_path: "/uploads/dam_breach_suspicious.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-building-1",
      report_id: "report-building-senior-approved",
      file_path: "/uploads/building_collapse.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-ito-1",
      report_id: "sample-report-1",
      file_path: "/uploads/ito_flooding.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
    {
      id: "media-landslide-1",
      report_id: "report-landslide-pending",
      file_path: "/uploads/landslide_shimla.jpg",
      file_type: "image",
      created_at: new Date().toISOString(),
    },
  ];

  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  console.log("✓ Updated backend/db/data.json media collection cleanly!");
}

run().catch(console.error);
