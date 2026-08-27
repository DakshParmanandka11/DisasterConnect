const fs = require("fs");
const path = require("path");
const https = require("https");

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(__dirname, "db", "data.json");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Curation of accurate disaster images from Unsplash
const IMAGES = [
  {
    filename: "flood_lajpat.jpg",
    // Major urban flooding, submerged vehicles and city street under deep water
    url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "storm_nh48.jpg",
    // Severe storm damage, fallen power lines & trees across highway
    url: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "fire_okhla.jpg",
    // Large industrial factory fire with massive black smoke column
    url: "https://images.unsplash.com/photo-1565689157206-0fddef7589a2?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "building_collapse.jpg",
    // Earthquake building collapse rubble & structural destruction
    url: "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "ito_flooding.jpg",
    // Submerged urban underpass & city floodwaters
    url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "landslide_shimla.jpg",
    // Massive mountain landslide & rock debris blocking mountain highway
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "dam_breach_suspicious.jpg",
    // Hydroelectric dam spillway & high volume discharge
    url: "https://images.unsplash.com/photo-1468436139062-f60a71c5c892?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "gibberish_random.jpg",
    // Keyboard / random glitch screen (for rejected gibberish post)
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "red_nike_shoes.jpg",
    // Red Nike sneakers (for rejected irrelevant commercial post)
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop",
  },
  {
    filename: "flood_duplicate.jpg",
    // Urban flood street scene
    url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=1200&auto=format&fit=crop",
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

const MAJOR_REPORTS = [
  {
    id: "report-flood-pending",
    user_id: "citizen-reporter-1",
    title: "Severe Yamuna River Inundation & Ring Road Submersion",
    description: "Yamuna water level has crossed 208.66m (highest in 45 years). Heavy discharge from Hathnikund Barrage has submerged Ring Road, Monastery Market, and ISBT Kashmere Gate. Over 25,000 residents being evacuated. Main water treatment plants (Wazirabad & Chandrawal) shut down, impacting drinking water supply for 1.5 million citizens. Emergency NDRF rescue boats deployed.",
    category: "flood",
    severity: "critical",
    lat: 28.6675,
    lng: 77.2312,
    status: "pending",
    moderation_status: "PENDING_MODERATOR",
    relevance_score: 98,
    gibberish_score: 0,
    spam_score: 1,
    duplicate_probability: 4,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "verified",
    confirmations: 1,
    assigned_moderator_id: "demo-moderator-id",
    created_at: "2026-08-27T17:00:00.000Z"
  },
  {
    id: "report-road-approved",
    user_id: "citizen-reporter-2",
    title: "Super Cyclone Storm Surge — Fallen Power Towers & Highway Blockage on NH-48",
    description: "Super Cyclone wind gusts exceeding 130 km/h have collapsed major high-tension electricity transmission towers and dozens of massive trees across the 8-lane NH-48 expressway between Delhi and Gurgaon. Over 800 commuter vehicles trapped in massive gridlock. Power blackouts affect 4 municipal sectors.",
    category: "storm",
    severity: "high",
    lat: 28.4595,
    lng: 77.0266,
    status: "pending",
    moderation_status: "APPROVED_BY_MODERATOR",
    relevance_score: 92,
    gibberish_score: 0,
    spam_score: 2,
    duplicate_probability: 6,
    upvotes: 12,
    downvotes: 1,
    remote_votes: 3,
    exif_status: "verified",
    confirmations: 2,
    assigned_moderator_id: "demo-moderator-id",
    moderated_by: "demo-moderator-id",
    moderation_decision: "approve",
    moderation_reason: "Major genuine calamity with high-tension power grid damage and severe arterial highway blockage.",
    moderated_at: "2026-08-26T08:00:00.000Z",
    created_at: "2026-08-26T06:00:00.000Z"
  },
  {
    id: "report-fire-community-verified",
    user_id: "citizen-reporter-1",
    title: "Catastrophic Chemical Plant Explosion & Toxic Smoke Inferno in Industrial Zone",
    description: "Multiple massive chemical storage tank explosions occurred at a major solvent manufacturing plant in Okhla Industrial Area. Toxic black smoke plumes rising over 600 metres into the sky. Mass evacuation ordered for 3 surrounding residential colonies (pop. 35,000+). 22 fire tenders and HAZMAT units on scene.",
    category: "fire",
    severity: "critical",
    lat: 28.5355,
    lng: 77.2648,
    status: "flagged",
    moderation_status: "COMMUNITY_VERIFIED",
    relevance_score: 99,
    gibberish_score: 0,
    spam_score: 1,
    duplicate_probability: 2,
    upvotes: 24,
    downvotes: 1,
    remote_votes: 8,
    exif_status: "verified",
    confirmations: 4,
    assigned_moderator_id: "demo-mod-2-id",
    moderated_by: "demo-mod-2-id",
    moderation_decision: "approve",
    moderation_reason: "Critical industrial disaster verified by community and multiple eyewitness emergency reports.",
    moderated_at: "2026-08-25T11:00:00.000Z",
    created_at: "2026-08-25T10:00:00.000Z"
  },
  {
    id: "report-building-senior-approved",
    user_id: "citizen-reporter-2",
    title: "Magnitude 6.4 Earthquake — Collapse of Multi-Storey Commercial Complex",
    description: "A major 6.4 magnitude earthquake centered in the NCR region has caused catastrophic structural collapse of an 8-storey commercial complex in Vasant Kunj. Heavy concrete debris trapping over 50 victims. National Disaster Response Force (NDRF) USAR heavy rescue units & sniffer dog teams deployed.",
    category: "earthquake",
    severity: "critical",
    lat: 28.5245,
    lng: 77.1564,
    status: "flagged",
    moderation_status: "APPROVED_BY_SENIOR",
    relevance_score: 97,
    gibberish_score: 0,
    spam_score: 1,
    duplicate_probability: 3,
    upvotes: 31,
    downvotes: 0,
    remote_votes: 12,
    exif_status: "verified",
    confirmations: 3,
    assigned_moderator_id: "demo-mod-3-id",
    moderated_by: "demo-senior-mod-id",
    moderation_decision: "approve",
    moderation_reason: "Severe earthquake disaster confirmed by Senior Moderator & NDRF command.",
    moderated_at: "2026-08-24T15:00:00.000Z",
    senior_reviewed_by: "demo-senior-mod-id",
    senior_reviewed_at: "2026-08-24T15:30:00.000Z",
    created_at: "2026-08-24T14:00:00.000Z"
  },
  {
    id: "sample-report-1",
    user_id: "guest-citizen-anon-id",
    title: "Record Monsoon Inundation — ITO Metro Junction Submerged Under 8 Feet Water",
    description: "Record 153mm rainfall in 24 hours has completely flooded the ITO Underpass and arterial traffic junction. Multiple public transit buses submerged to window levels. Central business district access cut off. Emergency drainage pumps deployed.",
    category: "flood",
    severity: "high",
    lat: 28.6289,
    lng: 77.2409,
    status: "flagged",
    moderation_status: "COMMUNITY_VERIFIED",
    relevance_score: 96,
    gibberish_score: 0,
    spam_score: 2,
    duplicate_probability: 8,
    upvotes: 19,
    downvotes: 1,
    remote_votes: 5,
    exif_status: "verified",
    confirmations: 2,
    assigned_moderator_id: "demo-mod-2-id",
    moderated_by: "demo-mod-2-id",
    moderation_decision: "approve",
    moderation_reason: "High-impact arterial flooding confirmed by local citizens.",
    moderated_at: "2026-08-25T08:00:00.000Z",
    created_at: "2026-08-25T06:59:06.864Z"
  },
  {
    id: "report-landslide-pending",
    user_id: "citizen-reporter-1",
    title: "Massive Mountain Landslide & Highway Destruction on Shimla National Highway",
    description: "Severe cloudburst triggered a massive mountain collapse near Dharampur on the Chandigarh-Shimla Highway. Over 300 metres of mountain highway wiped out into the valley. Over 1,500 tourist and freight vehicles trapped. Heavy excavators clearing boulders.",
    category: "landslide",
    severity: "high",
    lat: 30.9275,
    lng: 76.9876,
    status: "pending",
    moderation_status: "PENDING_MODERATOR",
    relevance_score: 93,
    gibberish_score: 0,
    spam_score: 3,
    duplicate_probability: 2,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    assigned_moderator_id: "demo-mod-2-id",
    created_at: "2026-08-27T16:00:00.000Z"
  },
  {
    id: "report-suspicious-escalated",
    user_id: "guest-citizen-anon-id",
    title: "Urgent Dam Failure Alarm — Uncontrolled Water Discharge Threatening Downstream Towns",
    description: "Sensational social media claims reporting structural failure at upstream barrage threatening downstream urban sectors within 2 hours. High panic potential. Requires senior moderator and official irrigation authority verification.",
    category: "flood",
    severity: "critical",
    lat: 28.5421,
    lng: 77.3026,
    status: "pending",
    moderation_status: "ESCALATED",
    relevance_score: 75,
    gibberish_score: 5,
    spam_score: 40,
    duplicate_probability: 10,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    assigned_moderator_id: "demo-moderator-id",
    moderated_by: "demo-moderator-id",
    moderation_decision: "escalate",
    moderation_reason: "High panic potential — unverified dam breach claim escalated to Senior Moderator for official verification.",
    escalated_reason: "High panic potential / Unverified claim",
    moderated_at: "2026-08-27T12:00:00.000Z",
    created_at: "2026-08-27T11:30:00.000Z"
  },
  {
    id: "report-gibberish-rejected",
    user_id: "guest-citizen-anon-id",
    title: "OMG OMG HELP HELP!!!!!!!!! NO WAYYYY",
    description: "asdfjklasdfjklasdfj HELP OMG OMG OMG OMG OMG OMG OMG HELP PLEASE AAAAAA!!!!!! random keyboard spam text!!",
    category: "other",
    severity: "low",
    lat: 28.6139,
    lng: 77.209,
    status: "pending",
    moderation_status: "REJECTED_BY_MODERATOR",
    relevance_score: 18,
    gibberish_score: 90,
    spam_score: 95,
    duplicate_probability: 12,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    assigned_moderator_id: "demo-moderator-id",
    moderated_by: "demo-moderator-id",
    moderation_decision: "reject",
    moderation_reason: "Gibberish / insufficient information",
    moderated_at: "2026-08-27T10:00:00.000Z",
    created_at: "2026-08-27T09:45:00.000Z"
  },
  {
    id: "report-irrelevant-rejected",
    user_id: "guest-citizen-anon-id",
    title: "Selling Limited Edition Red Nike Air Force 1s — Size 10",
    description: "Brand new in box, limited edition red Nike sneakers for sale at half price. DM if interested, located near CP.",
    category: "other",
    severity: "low",
    lat: 28.6139,
    lng: 77.209,
    status: "pending",
    moderation_status: "REJECTED_BY_MODERATOR",
    relevance_score: 4,
    gibberish_score: 0,
    spam_score: 88,
    duplicate_probability: 2,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    assigned_moderator_id: "demo-moderator-id",
    moderated_by: "demo-moderator-id",
    moderation_decision: "reject",
    moderation_reason: "Irrelevant (Commercial spam post)",
    moderated_at: "2026-08-27T10:30:00.000Z",
    created_at: "2026-08-27T10:15:00.000Z"
  },
  {
    id: "report-duplicate-rejected",
    user_id: "citizen-reporter-2",
    title: "Yamuna Water Overflow at Ring Road",
    description: "Water from Yamuna river spilling onto Ring Road near Monastery market.",
    category: "flood",
    severity: "high",
    lat: 28.6678,
    lng: 77.2315,
    status: "pending",
    moderation_status: "REJECTED_BY_MODERATOR",
    relevance_score: 85,
    gibberish_score: 0,
    spam_score: 5,
    duplicate_probability: 92,
    upvotes: 0,
    downvotes: 0,
    remote_votes: 0,
    exif_status: "missing",
    confirmations: 1,
    assigned_moderator_id: "demo-mod-2-id",
    moderated_by: "demo-mod-2-id",
    moderation_decision: "reject",
    moderation_reason: "Duplicate of report-flood-pending",
    moderated_at: "2026-08-27T11:00:00.000Z",
    created_at: "2026-08-27T09:00:00.000Z"
  }
];

async function run() {
  console.log("Downloading large-scale disaster images to backend/uploads...");
  for (const img of IMAGES) {
    const dest = path.join(UPLOADS_DIR, img.filename);
    try {
      await downloadFile(img.url, dest);
      console.log(`✓ Downloaded ${img.filename}`);
    } catch (e) {
      console.error(`✕ Error downloading ${img.filename}:`, e.message);
    }
  }

  // Update backend/db/data.json
  const dataRaw = fs.readFileSync(DATA_FILE, "utf-8");
  const db = JSON.parse(dataRaw);

  db.reports = MAJOR_REPORTS;

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
    {
      id: "media-dam-1",
      report_id: "report-suspicious-escalated",
      file_path: "/uploads/dam_breach_suspicious.jpg",
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
  ];

  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  console.log("✓ Updated backend/db/data.json with major large-scale disaster reports & media!");
}

run().catch(console.error);
