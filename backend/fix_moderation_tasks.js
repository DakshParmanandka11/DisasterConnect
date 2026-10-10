const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("./db");

function fixTasks() {
  const dbData = readDb();
  if (!dbData.moderationTasks) dbData.moderationTasks = [];
  if (!dbData.reports) dbData.reports = [];

  const modUserId = "demo-moderator-id";

  // Assign pending reports to demo-moderator-id
  dbData.reports.forEach((report) => {
    if (report.moderation_status === "PENDING_MODERATOR") {
      report.assigned_moderator_id = modUserId;

      const existingTask = dbData.moderationTasks.find(
        (t) => t.report_id === report.id && t.moderator_id === modUserId
      );

      if (!existingTask) {
        dbData.moderationTasks.push({
          id: uuidv4(),
          report_id: report.id,
          moderator_id: modUserId,
          status: "pending",
          assigned_at: new Date().toISOString(),
          completed_at: null,
        });
      }
    }
  });

  writeDb(dbData);
  console.log(`✅ Fixed moderation tasks! Assigned ${dbData.moderationTasks.length} tasks to student moderator ${modUserId}`);
}

fixTasks();
