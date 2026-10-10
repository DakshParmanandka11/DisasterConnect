/**
 * TinyFish evidence-gathering service (Search API + Fetch API).
 *
 * Contract verified against https://docs.tinyfish.ai/search-api/reference.md and
 * https://docs.tinyfish.ai/fetch-api/reference.md:
 *   Search: GET  https://api.search.tinyfish.ai?query=...   header X-API-Key
 *   Fetch : POST https://api.fetch.tinyfish.ai  {urls:[...], format:"markdown"}  header X-API-Key
 *
 * Design rules:
 *  - The API key is read from process.env.TINYFISH_API_KEY only. It is never logged,
 *    never returned to a client, never included in error messages.
 *  - Everything returned by TinyFish or by a fetched page is UNTRUSTED DATA. It is
 *    stripped, truncated and stored as plain text. It is never evaluated, never used
 *    to build further requests (other than fetching URLs that already came back from
 *    the search), and never influences moderation state.
 *  - Failures are returned as structured results, never thrown to callers.
 */

const SEARCH_URL = process.env.TINYFISH_SEARCH_URL || "https://api.search.tinyfish.ai";
const FETCH_URL = process.env.TINYFISH_FETCH_URL || "https://api.fetch.tinyfish.ai";

const SEARCH_TIMEOUT_MS = Number(process.env.TINYFISH_SEARCH_TIMEOUT_MS) || 10000;
const FETCH_TIMEOUT_MS = Number(process.env.TINYFISH_FETCH_TIMEOUT_MS) || 20000;

const MAX_FINDINGS = 8;
const MAX_FETCHES = 2; // Fetch API is only used on a few official results
const MAX_SUMMARY_CHARS = 320;
const MAX_TITLE_CHARS = 160;

// Client-side guard so we never knowingly exceed TinyFish's default 30 req/min per key.
const LOCAL_MAX_REQ_PER_MIN = Number(process.env.TINYFISH_LOCAL_RPM) || 20;
const requestLog = [];

function isConfigured() {
  return Boolean(process.env.TINYFISH_API_KEY && process.env.TINYFISH_API_KEY.trim());
}

// ── Source classification ──────────────────────────────────────────────────────
// Conservative, domain-based. "official" is only assigned when the hostname matches an
// explicit government/authority pattern. Search rank is never used as evidence of authority.
const OFFICIAL_SUFFIXES = [".gov.in", ".nic.in", ".gov", ".mil"];
const OFFICIAL_EXACT = new Set([
  "imd.gov.in", "ndma.gov.in", "ndrf.gov.in", "cwc.gov.in", "gsi.gov.in",
  "seismo.gov.in", "incois.gov.in", "nrsc.gov.in", "fsi.nic.in", "mha.gov.in",
  "usgs.gov", "who.int", "reliefweb.int", "unocha.org", "gdacs.org",
]);
const OFFICIAL_ALLOW_DOMAINS_BY_CATEGORY = {
  flood: ["cwc.gov.in", "imd.gov.in", "ndma.gov.in"],
  storm: ["imd.gov.in", "ndma.gov.in", "incois.gov.in"],
  cyclone: ["imd.gov.in", "ndma.gov.in", "incois.gov.in"],
  earthquake: ["seismo.gov.in", "ndma.gov.in", "usgs.gov"],
  landslide: ["gsi.gov.in", "ndma.gov.in", "imd.gov.in"],
  fire: ["fsi.nic.in", "ndma.gov.in", "ndrf.gov.in"],
  default: ["ndma.gov.in", "imd.gov.in", "ndrf.gov.in"],
};

function hostnameOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch (_) {
    return null;
  }
}

function isOfficialHost(host) {
  if (!host) return false;
  if (OFFICIAL_EXACT.has(host)) return true;
  for (const d of OFFICIAL_EXACT) if (host.endsWith("." + d)) return true;
  return OFFICIAL_SUFFIXES.some((s) => host.endsWith(s));
}

function classifySource(host, fromNewsSearch) {
  if (isOfficialHost(host)) return "official";
  if (fromNewsSearch) return "news";
  return "other";
}

// ── Text hygiene (all external text is untrusted) ─────────────────────────────
function cleanText(value, max) {
  if (typeof value !== "string") return "";
  let s = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

function toIsoOrNull(value) {
  if (!value || typeof value !== "string") return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  const year = new Date(t).getUTCFullYear();
  if (year < 1990 || t > Date.now() + 24 * 3600 * 1000) return null; // implausible → don't guess
  return new Date(t).toISOString();
}

// ── Query construction (derived only from stored, validated report data) ──────
const STOP_WORDS = new Set([
  "the", "and", "for", "near", "from", "with", "this", "that", "heavy", "severe", "massive",
  "major", "extreme", "report", "alert", "area", "district", "village", "city", "road",
  "flood", "floods", "flooding", "fire", "fires", "landslide", "earthquake", "cyclone", "storm",
  "cloudburst", "waterlogging", "emergency", "help", "urgent", "magnitude", "strikes", "blocks",
  "highway", "forest", "wildfire", "monsoon", "rain", "rainfall", "dust", "engulfs", "landfall",
]);

/** Pull candidate place names (capitalised tokens) from title/description. Heuristic, labelled as such. */
function extractPlaceTokens(report) {
  const text = `${report.title || ""} ${report.description || ""}`;
  const tokens = [];
  const re = /\b[A-Z][a-zA-Z]{3,}\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[0];
    if (STOP_WORDS.has(t.toLowerCase())) continue;
    if (!tokens.some((x) => x.toLowerCase() === t.toLowerCase())) tokens.push(t);
    if (tokens.length >= 4) break;
  }
  return tokens;
}

const CATEGORY_TERMS = {
  flood: "flood", storm: "storm warning", cyclone: "cyclone warning", earthquake: "earthquake",
  landslide: "landslide", fire: "fire", other: "disaster",
};

function buildQueries(report) {
  const category = String(report.category || "other").toLowerCase();
  const categoryTerm = CATEGORY_TERMS[category] || "disaster";
  const places = extractPlaceTokens(report);
  const placePart = places.join(" ");
  const base = `${categoryTerm} ${placePart}`.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);

  const officialDomains = OFFICIAL_ALLOW_DOMAINS_BY_CATEGORY[category] || OFFICIAL_ALLOW_DOMAINS_BY_CATEGORY.default;

  const created = new Date(report.created_at || Date.now());
  const after = new Date(created.getTime() - 3 * 24 * 3600 * 1000);
  const afterDate = Number.isNaN(after.getTime()) ? undefined : after.toISOString().slice(0, 10);

  return {
    category,
    places,
    official: {
      query: `${base} alert advisory`.trim(),
      include_domains: officialDomains.join(","),
      purpose: "Find official public advisories that may corroborate or contradict a citizen-submitted disaster report. Evidence for human review only.",
    },
    news: {
      query: `${base} ${category === "other" ? "" : "India"}`.trim(),
      domain_type: "news",
      after_date: afterDate,
      purpose: "Find recent news coverage of a reported local disaster for a human moderator to review.",
    },
  };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function codeForStatus(status) {
  if (status === 401) return "AUTH_FAILED";
  if (status === 402) return "CREDITS_EXHAUSTED";
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400 || status === 422) return "BAD_REQUEST";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "UPSTREAM_ERROR";
  return "HTTP_ERROR";
}

function localRateCheck() {
  const now = Date.now();
  while (requestLog.length && now - requestLog[0] > 60000) requestLog.shift();
  if (requestLog.length >= LOCAL_MAX_REQ_PER_MIN) {
    const retryAfterSec = Math.ceil((60000 - (now - requestLog[0])) / 1000);
    return { code: "RATE_LIMITED", message: "Local TinyFish request budget reached; try again shortly.", retryAfterSec };
  }
  requestLog.push(now);
  return null;
}

async function tfRequest(url, { method = "GET", body, timeoutMs }) {
  const limited = localRateCheck();
  if (limited) return { ok: false, error: limited };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": process.env.TINYFISH_API_KEY,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after"));
      return {
        ok: false,
        error: {
          code: codeForStatus(res.status),
          // Deliberately generic: upstream bodies are not echoed to clients.
          message: `TinyFish responded with HTTP ${res.status}.`,
          httpStatus: res.status,
          ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSec: retryAfter } : {}),
        },
      };
    }

    let json;
    try {
      json = await res.json();
    } catch (_) {
      return { ok: false, error: { code: "INVALID_RESPONSE", message: "TinyFish returned a non-JSON response." } };
    }
    return { ok: true, json };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return { ok: false, error: { code: "TIMEOUT", message: `TinyFish did not respond within ${Math.round(timeoutMs / 1000)}s.` } };
    }
    return { ok: false, error: { code: "NETWORK_ERROR", message: "Could not reach TinyFish." } };
  } finally {
    clearTimeout(timer);
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
async function search(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ location: "IN", language: "en", ...params })) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const r = await tfRequest(`${SEARCH_URL}?${qs.toString()}`, { timeoutMs: SEARCH_TIMEOUT_MS });
  if (!r.ok) return r;
  const results = r.json && Array.isArray(r.json.results) ? r.json.results : null;
  if (!results) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: "TinyFish search response had no results array." } };
  }
  return { ok: true, results };
}

// ── Fetch (clean content for a few official URLs) ────────────────────────────
async function fetchPages(urls) {
  const safe = urls.filter((u) => hostnameOf(u)).slice(0, MAX_FETCHES);
  if (!safe.length) return { ok: true, pages: new Map(), errors: [] };
  const r = await tfRequest(FETCH_URL, {
    method: "POST",
    timeoutMs: FETCH_TIMEOUT_MS,
    body: {
      urls: safe,
      format: "markdown",
      per_url_timeout_ms: Math.max(1000, FETCH_TIMEOUT_MS - 3000),
      purpose: "Read an official advisory page to summarise what it says for a disaster-report moderator.",
    },
  });
  if (!r.ok) return r;
  if (!r.json || !Array.isArray(r.json.results)) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: "TinyFish fetch response had no results array." } };
  }
  const pages = new Map();
  for (const p of r.json.results) {
    if (p && typeof p.url === "string") pages.set(p.url, p);
  }
  return { ok: true, pages, errors: Array.isArray(r.json.errors) ? r.json.errors : [] };
}

// ── Normalisation ─────────────────────────────────────────────────────────────
function geographicRelevance(placeTokens, ...texts) {
  if (!placeTokens.length) return "uncertain";
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  const hit = placeTokens.some((t) => hay.includes(t.toLowerCase()));
  // We can only confirm a textual place-name match. Absence of a match is "uncertain", not "unrelated":
  // we do not have grounds to assert a source is about somewhere else.
  return hit ? "relevant" : "uncertain";
}

function normalizeResult(raw, { fromNews, places, retrievedAt }) {
  if (!raw || typeof raw.url !== "string") return null;
  const host = hostnameOf(raw.url);
  if (!host) return null; // drops javascript:, data:, malformed, etc.
  const title = cleanText(raw.title, MAX_TITLE_CHARS) || host;
  const snippet = cleanText(raw.snippet, MAX_SUMMARY_CHARS);
  return {
    title,
    url: raw.url,
    sourceName: cleanText(raw.publisher || raw.site_name || host, 80),
    sourceType: classifySource(host, fromNews),
    publishedAt: toIsoOrNull(raw.date), // null when absent/implausible — never invented
    retrievedAt,
    summary: snippet,
    geographicRelevance: geographicRelevance(places, title, snippet),
    contentChecked: false, // true only if the page body itself was fetched and read
  };
}

/**
 * Gather evidence for a stored report. Never throws.
 * @returns {Promise<{status, error, findings, queries, notes}>}
 */
async function gatherEvidence(report) {
  const retrievedAt = new Date().toISOString();
  const queries = buildQueries(report);
  const base = { provider: "tinyfish", checkedAt: retrievedAt, queries: { official: queries.official.query, news: queries.news.query } };

  if (!isConfigured()) {
    return {
      ...base,
      status: "unavailable",
      findings: [],
      error: { code: "NOT_CONFIGURED", message: "TINYFISH_API_KEY is not set on the server. Evidence lookup is disabled; moderation is unaffected." },
    };
  }

  const [officialRes, newsRes] = await Promise.all([search(queries.official), search(queries.news)]);

  if (!officialRes.ok && !newsRes.ok) {
    return { ...base, status: "failed", findings: [], error: officialRes.error };
  }

  const findings = [];
  const seen = new Set();
  const add = (list, fromNews) => {
    for (const raw of list || []) {
      const f = normalizeResult(raw, { fromNews, places: queries.places, retrievedAt });
      if (!f) continue;
      const key = f.url.replace(/[#?].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  };
  if (officialRes.ok) add(officialRes.results.slice(0, 6), false);
  if (newsRes.ok) add(newsRes.results.slice(0, 6), true);

  // Official sources first, then those with a textual place match.
  const rank = (f) => (f.sourceType === "official" ? 0 : f.sourceType === "news" ? 1 : 2) * 10 + (f.geographicRelevance === "relevant" ? 0 : 1);
  findings.sort((a, b) => rank(a) - rank(b));
  const limited = findings.slice(0, MAX_FINDINGS);

  // Enrich up to MAX_FETCHES official findings with clean page content.
  const officialUrls = limited.filter((f) => f.sourceType === "official").map((f) => f.url);
  let fetchError = null;
  if (officialUrls.length) {
    const fr = await fetchPages(officialUrls);
    if (!fr.ok) {
      fetchError = fr.error;
    } else {
      for (const f of limited) {
        const page = fr.pages.get(f.url);
        if (!page) continue;
        const body = typeof page.text === "string" ? page.text : "";
        const desc = typeof page.description === "string" ? page.description : "";
        const summary = cleanText(desc || body, MAX_SUMMARY_CHARS);
        if (summary) f.summary = summary;
        f.contentChecked = true;
        const pageDate = toIsoOrNull(page.published_date);
        if (pageDate && !f.publishedAt) f.publishedAt = pageDate;
        f.geographicRelevance = geographicRelevance(queries.places, f.title, desc, body.slice(0, 4000));
      }
    }
  }

  const partialErrors = [];
  if (!officialRes.ok) partialErrors.push(`official-source search: ${officialRes.error.code}`);
  if (!newsRes.ok) partialErrors.push(`news search: ${newsRes.error.code}`);
  if (fetchError) partialErrors.push(`page fetch: ${fetchError.code}`);

  return {
    ...base,
    status: partialErrors.length ? "partial" : "completed",
    findings: limited,
    error: partialErrors.length ? { code: "PARTIAL", message: `Some lookups failed (${partialErrors.join("; ")}). Results shown are incomplete.` } : null,
  };
}

module.exports = {
  gatherEvidence,
  isConfigured,
  // exported for tests
  _internal: { buildQueries, classifySource, hostnameOf, cleanText, toIsoOrNull, extractPlaceTokens, normalizeResult, geographicRelevance },
};
