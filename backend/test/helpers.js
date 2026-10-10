// Test helper: lets route logic run without the real express/multer/etc. packages installed.
// If real packages exist they are NOT replaced; only missing ones are shimmed.
const Module = require("module");
const crypto = require("crypto");

function shim(name, impl) {
  try { require.resolve(name); return false; } catch (_) { /* missing → shim */ }
  const orig = Module._load;
  Module._load = function (request, ...rest) {
    if (request === name) return impl;
    return orig.call(this, request, ...rest);
  };
  return true;
}

function makeRouter() {
  const routes = [];
  const add = (method) => (path, ...handlers) => routes.push({ method, path, handlers });
  const r = { routes, get: add("get"), post: add("post"), put: add("put"), delete: add("delete"), use() {} };
  return r;
}
const express = () => ({});
express.Router = makeRouter;
express.json = () => (q, s, n) => n();
express.urlencoded = () => (q, s, n) => n();
express.static = () => (q, s, n) => n();

const multer = () => ({ array: () => (q, s, n) => n() });
multer.diskStorage = () => ({});

const shimmed = {
  multer: shim("multer", multer),
  express: shim("express", express),
  uuid: shim("uuid", { v4: () => crypto.randomUUID() }),
  bcryptjs: shim("bcryptjs", { hashSync: (x) => "h:" + x, compareSync: () => true }),
  jsonwebtoken: shim("jsonwebtoken", { sign: () => "t", verify: () => { throw new Error("no"); } }),
};

/** Invoke a router handler chain with fake req/res; resolves with {status, body, headers}. */
async function call(router, method, path, { user, params = {}, body = {}, query = {} } = {}) {
  const route = router.routes.find((r) => r.method === method && r.path === path);
  if (!route) throw new Error(`no route ${method} ${path}`);
  return new Promise((resolve, reject) => {
    const headers = {};
    const res = {
      statusCode: 200,
      set(k, v) { headers[k] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b, headers }); return this; },
    };
    const req = { user, params, body, query, headers: {} };
    let i = 0;
    const next = (err) => {
      if (err) return reject(err);
      const h = route.handlers[i++];
      if (!h) return;
      try {
        const out = h(req, res, next);
        if (out && typeof out.catch === "function") out.catch(reject);
      } catch (e) { reject(e); }
    };
    next();
  });
}

module.exports = { shimmed, call };
