const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
require("./helpers");

process.env.DC_DB_FILE = path.join(os.tmpdir(), `dc-auth-${process.pid}.json`);
const { requireAuth, optionalAuth } = require("../util/auth");

function run(mw, headers = {}) {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  const req = { headers };
  let nexted = false;
  mw(req, res, () => { nexted = true; });
  return { req, res, nexted };
}

test("requireAuth rejects missing and invalid tokens with 401 (no guest fallback)", () => {
  for (const headers of [{}, { authorization: "Bearer garbage" }, { authorization: "Basic abc" }]) {
    const r = run(requireAuth, headers);
    assert.strictEqual(r.nexted, false);
    assert.strictEqual(r.res.code, 401);
    assert.strictEqual(r.req.user, undefined);
  }
});

test("optionalAuth falls back to guest citizen only where used", () => {
  const r = run(optionalAuth, {});
  assert.strictEqual(r.nexted, true);
  assert.strictEqual(r.req.user.role, "citizen");
  assert.strictEqual(r.req.user.id, "guest-citizen-anon-id");
});

test.after(() => { try { fs.unlinkSync(process.env.DC_DB_FILE); } catch (_) {} });
