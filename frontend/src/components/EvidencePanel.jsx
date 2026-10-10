import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

const TYPE_STYLE = {
  official: { label: "Official source", bg: "rgba(16,185,129,0.12)", fg: "#0f9f6e" },
  news: { label: "News", bg: "rgba(99,102,241,0.12)", fg: "#5b5bd6" },
  other: { label: "Unclassified", bg: "rgba(148,163,184,0.18)", fg: "#64748b" },
};
const GEO_STYLE = {
  relevant: { label: "Place name matches", fg: "#0f9f6e" },
  uncertain: { label: "Location uncertain", fg: "#b7791f" },
  unrelated: { label: "Different location", fg: "#c53030" },
};
const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : null);

/**
 * Moderator-only panel. Shows externally retrieved material as corroboration for a HUMAN decision.
 * It never approves/rejects anything and has no effect on the decision buttons.
 */
export default function EvidencePanel({ reportId }) {
  const [state, setState] = useState({ phase: "loading", data: null, error: null });
  const autoTried = useRef(false);

  const run = useCallback(async (force) => {
    setState((s) => ({ ...s, phase: "checking", error: null }));
    try {
      const data = await api.checkEvidence(reportId, force);
      setState({ phase: "done", data, error: null });
    } catch (e) {
      setState((s) => ({ phase: "error", data: s.data, error: e.message }));
    }
  }, [reportId]);

  useEffect(() => {
    let live = true;
    api.getEvidence(reportId)
      .then((data) => {
        if (!live) return;
        setState({ phase: "done", data, error: null });
        // One bounded automatic check per panel mount, only if nothing is stored and a key is configured.
        if (data.status === "not_checked" && data.configured && !autoTried.current) {
          autoTried.current = true;
          run(false);
        }
      })
      .catch((e) => live && setState({ phase: "error", data: null, error: e.message }));
    return () => { live = false; };
  }, [reportId, run]);

  const { phase, data, error } = state;
  const checking = phase === "checking" || phase === "loading";

  return (
    <div className="assessment-box" aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div className="assessment-title" style={{ margin: 0 }}>EXTERNAL EVIDENCE (PUBLIC SOURCES)</div>
        <button
          className="btn btn-outline btn-sm"
          disabled={checking || (data && data.configured === false)}
          onClick={() => run(true)}
        >
          {checking ? "Checking…" : data && data.status !== "not_checked" ? "Re-check" : "Check for evidence"}
        </button>
      </div>

      <p style={{ margin: "0 0 10px 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
        Corroboration for your judgement — not proof. Finding nothing does not mean the report is false.
      </p>

      {phase === "loading" && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading stored evidence…</p>}
      {phase === "checking" && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Searching official and news sources…</p>}

      {phase === "error" && (
        <div className="error-banner" style={{ fontSize: "0.82rem" }}>
          Could not load evidence: {error}. You can still review and decide on this report.
        </div>
      )}

      {data && data.configured === false && data.status !== "completed" && (
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          Evidence lookup is not configured on this server (no TinyFish API key). Moderation works normally without it.
        </div>
      )}

      {data && data.error && data.error.code !== "NOT_CONFIGURED" && (
        <div className="error-banner" style={{ fontSize: "0.82rem", marginBottom: 8 }}>
          {data.status === "partial" ? "Partial results: " : "Evidence lookup failed: "}
          {data.error.message}
        </div>
      )}

      {data && !checking && (data.status === "completed" || data.status === "partial") && data.findings.length === 0 && (
        <div style={{ fontSize: "0.85rem", color: "var(--text-body)" }}>
          No relevant public sources were found for this query. This is not evidence for or against the report.
        </div>
      )}

      {data && data.findings && data.findings.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {data.findings.map((f) => {
            const t = TYPE_STYLE[f.sourceType] || TYPE_STYLE.other;
            const g = GEO_STYLE[f.geographicRelevance] || GEO_STYLE.uncertain;
            return (
              <li key={f.url} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, background: "var(--bg-card)" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ background: t.bg, color: t.fg, padding: "1px 8px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700 }}>{t.label}</span>
                  <span style={{ color: g.fg, fontSize: "0.72rem", fontWeight: 600 }}>{g.label}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{f.sourceName}</span>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: "0.9rem", wordBreak: "break-word" }}>
                  {f.title} ↗
                </a>
                {f.summary && <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--text-body)", lineHeight: 1.5 }}>{f.summary}</p>}
                <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>Published: {fmt(f.publishedAt) || "not provided by source"}</span>
                  <span>Retrieved: {fmt(f.retrievedAt)}</span>
                  <span>{f.contentChecked ? "Page content read" : "Search snippet only"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.checkedAt && (
        <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--text-muted)" }}>
          Last checked {fmt(data.checkedAt)}{data.cached ? " (stored result)" : ""}
        </div>
      )}
    </div>
  );
}
