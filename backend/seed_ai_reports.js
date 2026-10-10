require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("./db");
const { fetchLiveGroundTruth } = require("./util/webSearch");
const { verifyIncidentReport } = require("./util/aiVerifier");

async function seedAiReports() {
  console.log("=== SEEDING REALISTIC AI-VERIFIED DISASTER REPORTS ===");

  const dbData = readDb();
  if (!dbData.reports) dbData.reports = [];
  if (!dbData.moderationTasks) dbData.moderationTasks = [];
  if (!dbData.media) dbData.media = [];

  const modUserId = "demo-moderator-id"; // Aarav Sharma

  const testScenarios = [
    {
      title: "Severe Urban Flooding & Waterlogging in Jamnagar",
      description: "Heavy monsoon downpour caused knee-deep inundation near Ring Road and Jamnagar Railway Station. Several vehicles stranded, traffic completely halted.",
      category: "flood",
      severity: "high",
      location: "Jamnagar Gujarat",
      lat: 22.4707,
      lng: 70.0577,
    },
    {
      title: "High-Speed Cyclonic Winds & Uprooted Trees in Puri",
      description: "Severe gale winds near Swargadwar and Golden Beach Puri. Power lines disrupted and trees blocking main arterial roads.",
      category: "cyclone",
      severity: "critical",
      location: "Puri Odisha",
      lat: 19.8135,
      lng: 85.8312,
    },
    {
      title: "Major Landslide Blocking National Highway near Shimla",
      description: "Debris and heavy boulders fell on the Shimla-Kalka highway following overnight rain. Highway movement restricted to single lane.",
      category: "landslide",
      severity: "moderate",
      location: "Shimla Himachal Pradesh",
      lat: 31.1048,
      lng: 77.1734,
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`\nRunning live Tavily Search & Gemini AI Verification for: "${scenario.title}"...`);

    const snippets = await fetchLiveGroundTruth({
      location: scenario.location,
      disasterType: scenario.category,
    });

    const newReport = {
      id: uuidv4(),
      user_id: "citizen-reporter-1",
      title: scenario.title,
      description: scenario.description,
      category: scenario.category,
      severity: scenario.severity,
      lat: scenario.lat,
      lng: scenario.lng,
      status: "pending",
      moderation_status: "PENDING_MODERATOR",
      relevance_score: 95,
      gibberish_score: 0,
      spam_score: 5,
      duplicate_probability: 10,
      upvotes: 4,
      downvotes: 0,
      remote_votes: 2,
      exif_status: "verified",
      confirmations: 1,
      assigned_moderator_id: modUserId,
      created_at: new Date().toISOString(),
    };

    const aiResult = await verifyIncidentReport({
      reportData: newReport,
      imagePath: null,
      searchSnippets: snippets,
    });

    newReport.aiVerification = aiResult;

    // Remove any existing duplicate report with same title
    dbData.reports = dbData.reports.filter(r => r.title !== scenario.title);
    dbData.reports.unshift(newReport);

    // Ensure moderation task exists
    dbData.moderationTasks = dbData.moderationTasks.filter(t => t.report_id !== newReport.id);
    dbData.moderationTasks.push({
      id: uuidv4(),
      report_id: newReport.id,
      moderator_id: modUserId,
      status: "pending",
      assigned_at: new Date().toISOString(),
      completed_at: null,
    });

    console.log(`✓ Generated report ${newReport.id} with verdict: ${aiResult.verdict} (Score: ${aiResult.corroboration_score}%)`);
  }

  writeDb(dbData);
  console.log("\n✅ Successfully seeded live AI-verified reports into database!");
}

seedAiReports().catch(console.error);
