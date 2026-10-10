const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { call } = require("./helpers");

const tmpDb = path.join(os.tmpdir(), `dc-wf-${process.pid}.json`);
fs.copyFileSync(path.join(__dirname, "..", "db", "data.json"), tmpDb); // copy: demo data is never modified
process.env.DC_DB_FILE = tmpDb;

// Auth stub keeps injected req.user but implements the REAL role check.
const authPath = require.resolve("../util/auth");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
  requireAuth: (q, s, n) => n(),
  optionalAuth: (q, s, n) => n(),
  signToken: () => "test-token",
  requireRole: (role) => (req, res, next) => req.user.role !== role ? res.status(403).json({ error: `Requires ${role} role` }) : next(),
} };

const reports = require("../routes/reports");
const moderator = require("../routes/moderator");
const ngo = require("../routes/ngo");
const auth = require("../routes/auth");
const admin = require("../routes/admin");
const { readDb, writeDb } = require("../db");
const { evaluateVerification } = require("../util/workflow");

test.after(() => { try { fs.unlinkSync(tmpDb); } catch (_) {} });

const REPORTER = { id: "citizen-reporter-1", role: "citizen" };
const MOD = { id: "demo-moderator-id", role: "student_moderator" };
const NGO = { id: "demo-ngo-1", role: "ngo" };
const citizen = (i) => ({ id: `voter-${i}`, role: "citizen" });
const HERE = { lat: 28.62, lng: 77.21 }; // Delhi, inside the seeded NGO's 50 km service radius
const FAR = { lat: 19.07, lng: 72.87 };  // Mumbai

const submit = (body, user = REPORTER) => call(reports, "post", "/", { user, body });
const vote = (id, user, body) => call(reports, "post", "/:id/vote", { user, params: { id }, body });
const good = { title: "Waterlogging at ITO crossing", description: "Knee deep water, vehicles stranded", category: "flood", severity: "high", ...HERE };

async function publishedReport(extra = {}) {
  const r = await submit({ ...good, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.report.id;
  const task = readDb().moderationTasks.find((t) => t.report_id === id);
  assert.ok(task, "report must be assigned a moderation task");
  const m = await call(moderator, "post", "/tasks/:taskId/approve", { user: { id: task.moderator_id, role: "student_moderator" }, params: { taskId: task.id }, body: { reason: "Genuine disaster report" } });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  return id;
}

// ── Validation ──
test("report validation rejects malformed input", async () => {
  const bad = [
    { ...good, lat: 91 }, { ...good, lat: "abc" }, { ...good, lng: -181 }, { ...good, lat: "" }, { ...good, lng: undefined },
    { ...good, title: "no" }, { ...good, title: "" }, { ...good, category: "meteor" }, { ...good, severity: "apocalyptic" },
    { ...good, description: "x".repeat(2001) }, { ...good, incident_time: "2999-01-01" },
  ];
  const before = readDb().reports.length;
  for (const b of bad) assert.equal((await submit(b)).status, 400, JSON.stringify(b).slice(0, 80));
  assert.equal(readDb().reports.length, before, "no invalid report may be stored");
});

test("valid report: pending, hidden from public feed, honest authenticity/location labels", async () => {
  const r = await submit({ ...good, category: "FLOOD", severity: "High" });
  assert.equal(r.status, 201);
  const rep = r.body.report;
  assert.equal(rep.category, "flood"); assert.equal(rep.severity, "high"); // normalised
  assert.equal(rep.moderation_status, "PENDING_MODERATOR");
  assert.equal(rep.exif_status, "no_media");
  assert.equal(rep.location_evidence, "coordinates_supplied_unverified");
  assert.equal(rep.screening_method, "rule_based_heuristic");
  const feed = await call(reports, "get", "/", { user: REPORTER, query: {} });
  assert.ok(!feed.body.reports.some((x) => x.id === rep.id));
  // pending detail hidden from strangers, visible to author
  assert.equal((await call(reports, "get", "/:id", { user: citizen(1), params: { id: rep.id } })).status, 404);
  assert.equal((await call(reports, "get", "/:id", { user: REPORTER, params: { id: rep.id } })).status, 200);
  const vp = await vote(rep.id, citizen(1), { vote_type: "up", ...HERE });
  assert.equal(vp.status, 409, "cannot vote before moderator approval");
});

// ── Voting integrity + verification + NGO notification ──
test("voting rules, quorum/threshold, idempotent verification, single NGO notification", async () => {
  const id = await publishedReport();
  const author = (await call(reports, "get", "/:id", { user: REPORTER, params: { id } })).body.report.user_id;

  assert.equal((await vote(id, { id: author, role: "citizen" }, { vote_type: "up", ...HERE })).status, 403, "author");
  assert.equal((await vote(id, { id: "guest-citizen-anon-id", role: "citizen" }, { vote_type: "up", ...HERE })).status, 401, "guest");
  assert.equal((await vote(id, { id: "m", role: "student_moderator" }, { vote_type: "up", ...HERE })).status, 403, "non-citizen");
  assert.equal((await vote(id, citizen(0), { vote_type: "sideways", ...HERE })).status, 400);
  assert.equal((await vote(id, citizen(0), { vote_type: "up", lat: "x", lng: 1 })).status, 400);
  assert.equal((await vote(id, citizen(0), { vote_type: "down", ...FAR })).status, 403, "out-of-radius cannot dispute");

  const remote = await vote(id, citizen(100), { vote_type: "up", ...FAR });
  assert.equal(remote.body.voteTier, "remote");
  assert.equal(remote.body.report.totalVotes, 0, "remote signal not counted");
  assert.equal((await vote(id, citizen(100), { vote_type: "up", ...FAR })).status, 409, "duplicate");

  const notifBefore = readDb().notifications.length;
  for (let i = 1; i <= 9; i++) {
    const r = await vote(id, citizen(i), { vote_type: "up", ...HERE });
    assert.equal(r.status, 200);
    assert.equal(r.body.flaggedNow, false, `no verification below quorum (vote ${i})`);
    assert.equal(r.body.report.moderation_status, "APPROVED_BY_MODERATOR");
  }
  assert.equal((await vote(id, citizen(5), { vote_type: "down", ...HERE })).status, 409, "no vote changing / double vote");

  const tenth = await vote(id, citizen(10), { vote_type: "up", ...HERE });
  assert.equal(tenth.body.flaggedNow, true);
  assert.equal(tenth.body.report.moderation_status, "COMMUNITY_VERIFIED");
  assert.equal(tenth.body.ngosNotified, 1);
  assert.equal(readDb().notifications.length, notifBefore + 1);

  // Idempotency: more votes and direct re-evaluation never re-notify
  await vote(id, citizen(11), { vote_type: "up", ...HERE });
  const db = readDb();
  const rep = db.reports.find((r) => r.id === id);
  const again = evaluateVerification(db, rep);
  assert.equal(again.transitioned, false);
  assert.equal(db.notifications.filter((n) => n.report_id === id).length, 1);

  // Tampered counters are overwritten by recomputation from vote records
  rep.upvotes = 9999; writeDb(db);
  const fresh = (await call(reports, "get", "/:id", { user: citizen(1), params: { id } })).body.report;
  assert.equal(fresh.upvotes, 11);
});

test("threshold enforced: 3 up / 7 down at quorum stays unverified; no notification", async () => {
  const id = await publishedReport({ title: "Disputed waterlogging claim near ITO" });
  const n0 = readDb().notifications.length;
  for (let i = 0; i < 10; i++) await vote(id, citizen(200 + i), { vote_type: i < 3 ? "up" : "down", ...HERE });
  const rep = readDb().reports.find((r) => r.id === id);
  assert.equal(rep.moderation_status, "APPROVED_BY_MODERATOR");
  assert.equal(readDb().notifications.length, n0);
});

test("NGO eligibility: unapproved or out-of-range NGOs are never notified", async () => {
  const db = readDb();
  db.ngo_profiles.push({ id: "ngo-pending", user_id: "u-p", org_name: "Pending NGO", service_lat: 28.62, service_lng: 77.21, service_radius_km: 50, verification_status: "pending" });
  db.ngo_profiles.push({ id: "ngo-far", user_id: "u-f", org_name: "Far NGO", service_lat: 9.9, service_lng: 76.3, service_radius_km: 25, verification_status: "approved" });
  writeDb(db);
  const id = await publishedReport({ title: "Another flooded underpass at Mathura Road" });
  for (let i = 0; i < 10; i++) await vote(id, citizen(300 + i), { vote_type: "up", ...HERE });
  const targets = readDb().notifications.filter((n) => n.report_id === id).map((n) => n.ngo_id);
  assert.deepEqual(targets, ["ngo-prof-1"]);
});

// ── NGO response workflow ──
test("NGO response: delivery separate from response; forward-only; idempotent; ownership enforced; report synced", async () => {
  const id = await publishedReport({ title: "Flooded lane near Lajpat Nagar market" });
  for (let i = 0; i < 10; i++) await vote(id, citizen(400 + i), { vote_type: "up", ...HERE });

  const list = await call(ngo, "get", "/notifications", { user: NGO });
  const item = list.body.notifications.find((n) => n.id === id);
  assert.equal(item.response_status, "new");
  assert.equal(item.delivery_status, "available_in_dashboard");
  assert.equal(item.delivery_channel, "in_app");
  const nid = item.notification_id;

  assert.equal((await call(ngo, "get", "/notifications", { user: REPORTER })).status, 403, "citizen blocked");
  assert.equal((await call(ngo, "post", "/notifications/:id/ack", { user: REPORTER, params: { id: nid } })).status, 403);

  const other = { id: "u-f", role: "ngo" };
  assert.equal((await call(ngo, "post", "/notifications/:id/ack", { user: other, params: { id: nid } })).status, 404, "another NGO cannot touch it (404, same as missing)");
  assert.equal(readDb().notifications.find((n) => n.id === nid).response_status, "new", "state unchanged after foreign attempt");

  const ack = await call(ngo, "post", "/notifications/:id/ack", { user: NGO, params: { id: nid } });
  assert.equal(ack.body.response_status, "acknowledged");
  const hist1 = readDb().notifications.find((n) => n.id === nid).history.length;
  await call(ngo, "post", "/notifications/:id/ack", { user: NGO, params: { id: nid } });
  assert.equal(readDb().notifications.find((n) => n.id === nid).history.length, hist1, "ack is idempotent");
  assert.equal(readDb().reports.find((r) => r.id === id).response_status, "acknowledged");

  assert.equal((await call(ngo, "post", "/notifications/:id/status", { user: NGO, params: { id: nid }, body: { status: "bogus" } })).status, 400);
  const resp = await call(ngo, "post", "/notifications/:id/status", { user: NGO, params: { id: nid }, body: { status: "responding", note: "Team dispatched with 2 boats" } });
  assert.equal(resp.body.response_status, "responding");
  assert.equal((await call(ngo, "post", "/notifications/:id/status", { user: NGO, params: { id: nid }, body: { status: "acknowledged" } })).status, 409, "no going backwards");
  const done = await call(ngo, "post", "/notifications/:id/status", { user: NGO, params: { id: nid }, body: { status: "resolved" } });
  assert.equal(done.body.response_status, "resolved");
  assert.equal(readDb().reports.find((r) => r.id === id).response_status, "resolved");

  // Persistence: state is on disk, not just in memory
  const disk = JSON.parse(fs.readFileSync(tmpDb, "utf8"));
  assert.equal(disk.notifications.find((n) => n.id === nid).response_status, "resolved");
  assert.equal(disk.notifications.find((n) => n.id === nid).response_note, "Team dispatched with 2 boats");
});

// ── NGO self-registration no longer auto-approved ──
test("NGO self-registration is pending and has no invented payment/contact details", async () => {
  const r = await call(auth, "post", "/register", { body: { name: "Test Relief", email: "x@test.org", password: "pw123456", role: "ngo", home_lat: 28.6, home_lng: 77.2, org_name: "Test Relief Trust" } });
  assert.equal(r.status, 201);
  const prof = readDb().ngo_profiles.find((n) => n.org_name === "Test Relief Trust");
  assert.equal(prof.verification_status, "pending");
  assert.equal(prof.upi_id, null);
  assert.equal(prof.contact_phone, null);
  const pub = await call(ngo, "get", "/public-list", {});
  assert.ok(!pub.body.ngos.some((n) => n.org_name === "Test Relief Trust"), "pending NGO not publicly listed");
  // Only an admin may approve; once approved the NGO becomes publicly listed.
  assert.equal(readDb().ngo_profiles.find((n) => n.id === prof.id).verification_status, "pending");
  const approve = admin.routes.find((x) => x.method === "post" && x.path === "/ngos/:id/approve");
  assert.ok(approve.handlers.length >= 2, "approve route has an auth/role guard chain");
  const ok = await call(admin, "post", "/ngos/:id/approve", { user: { id: "demo-admin-id", role: "admin" }, params: { id: prof.id } });
  assert.equal(ok.body.ngo.verification_status, "approved");
});
