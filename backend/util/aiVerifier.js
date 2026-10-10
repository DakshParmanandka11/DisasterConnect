const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const MASTER_SYSTEM_PROMPT = `You are an expert 3-Layer AI Crisis & Calamity Verifier for disaster reporting in India (working for DisasterConnect).
You act as Layer 3 (The Synthesizer), ingesting input from:
1. Citizen Incident Report & Photo Media
2. Layer 1 (The Scout): Tavily Search API snippets (news, Twitter/X, public chatter)
3. Layer 2 (The Deep Inspector): TinyFish AI Agent & Official Government Telemetry (Central Water Commission river gauges, IMD radar, rainfall mm, danger levels)

Your duty is to cross-reference all 3 layers to synthesize an accurate, objective evaluation of report credibility, disaster gravity, and required emergency relief.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "corroboration_score": 85,
  "gravity_level": 4,
  "verdict": "CORROBORATED",
  "summary_reasoning": "Detailed explanation synthesizing citizen text/media, Tavily web snippets, and official CWC/IMD telemetry.",
  "visual_damage_confirmed": true,
  "official_alerts_found": ["IMD Red Alert issued for coastal Odisha", "CWC Danger Level Exceeded"],
  "official_telemetry_summary": "River Gauge: 14.85m (Danger Mark: 14.00m) | Rainfall: 142.5mm/24h | Warning: RED_ALERT",
  "sources_cited": ["https://example.com/news1"],
  "recommended_relief_actions": {
    "ndrf_assets": ["Inflatable Boats", "Dewatering Pumps"],
    "ngo_supplies": ["Food Packets", "Drinking Water Cans", "First Aid Kits"]
  }
}

Verdict Rules:
- "CORROBORATED": Strong alignment across citizen report, web snippets, and official government telemetry/gauge levels.
- "UNVERIFIED": Plausible report with limited or inconclusive web/telemetry corroboration.
- "LIKELY_HOAX": Clear contradiction between report location/photo and official telemetry/news, or stock image reuse.

Gravity Level: Integer 1 (Minor localized issue) to 5 (Catastrophic widespread crisis).
Corroboration Score: Integer 0 to 100.
Be concise, authoritative, and tailored to Indian emergency administration (NDRF, SDRF, CWC, IMD).`;

function getFallbackResult(reason = "Automated AI verification pending") {
  return {
    corroboration_score: 50,
    gravity_level: 3,
    verdict: "UNVERIFIED",
    summary_reasoning: `Automatic verification could not be completed (${reason}). Report routed to student moderators for manual review.`,
    visual_damage_confirmed: false,
    official_alerts_found: [],
    official_telemetry_summary: "Telemetry unavailable — pending manual verification",
    sources_cited: [],
    recommended_relief_actions: {
      ndrf_assets: ["Standard Inspection Unit"],
      ngo_supplies: ["Food Packets", "Clean Water Cans", "First Aid Kits"],
    },
  };
}

/**
 * Layer 3 (The Synthesizer): Synthesizes report data, photo media, Tavily snippets, and TinyFish telemetry.
 *
 * @param {Object} params
 * @param {Object} params.reportData - Citizen report metadata
 * @param {string} [params.imagePath] - Uploaded media image path
 * @param {Array<Object>} [params.searchSnippets] - Layer 1 Scout web snippets
 * @param {Object} [params.officialTelemetry] - Layer 2 Inspector official telemetry
 * @returns {Promise<Object>} Verification verdict JSON
 */
async function verifyIncidentReport({ reportData, imagePath, searchSnippets = [], officialTelemetry = null, telemetryData = null }) {
  try {
    const telemetryObj = telemetryData || officialTelemetry;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("[aiVerifier] GEMINI_API_KEY missing in environment. Returning fallback UNVERIFIED verdict.");
      return getFallbackResult("GEMINI_API_KEY not configured");
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Format Layer 1 Scout snippets
    let snippetsText = "No web search snippets available.";
    if (Array.isArray(searchSnippets) && searchSnippets.length > 0) {
      snippetsText = searchSnippets
        .map((s, idx) => `[Snippet ${idx + 1}]\nTitle: ${s.title}\nURL: ${s.url}\nContent: ${s.content}`)
        .join("\n\n");
    }

    // 2. Format Layer 2 Inspector telemetry
    let telemetryText = "No official government telemetry available.";
    if (telemetryObj && typeof telemetryObj === "object") {
      telemetryText = JSON.stringify(telemetryObj, null, 2);
    }

    const userPrompt = `=== CITIZEN DISASTER REPORT ===
- Title: ${reportData.title || "N/A"}
- Category: ${reportData.category || "N/A"}
- Reported Severity: ${reportData.severity || "N/A"}
- Location/Coordinates: ${reportData.location || ""} (Lat: ${reportData.lat}, Lng: ${reportData.lng})
- Description: ${reportData.description || "No detailed description provided."}
- Reported At: ${reportData.created_at || new Date().toISOString()}

=== LAYER 1: SCOUT WEB & SOCIAL SNIPPETS (TAVILY) ===
${snippetsText}

=== LAYER 2: DEEP INSPECTOR OFFICIAL TELEMETRY (TINYFISH / CWC / IMD) ===
${telemetryText}

=== INSTRUCTIONS FOR LAYER 3 (SYNTHESIZER) ===
Evaluate this incident report by cross-referencing all 3 layers (Citizen Report & Photo, Tavily Web Snippets, and TinyFish Official Telemetry).
Determine whether the report is CORROBORATED, UNVERIFIED, or LIKELY_HOAX.
Generate specific NDRF/SDRF asset recommendations and NGO supply needs. Return strictly valid JSON conforming to the system prompt schema.`;

    const contents = [userPrompt];

    // Handle image attachment if present
    if (imagePath && typeof imagePath === "string") {
      let resolvedPath = imagePath;
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(__dirname, "..", imagePath.replace(/^\//, ""));
      }
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(__dirname, "..", "uploads", path.basename(imagePath));
      }

      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const buffer = fs.readFileSync(resolvedPath);
        const base64Data = buffer.toString("base64");
        const ext = path.extname(resolvedPath).toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".webp") mimeType = "image/webp";
        else if (ext === ".gif") mimeType = "image/gif";

        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }
    }

    const modelCandidates = [
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.5-flash"
    ];
    let response = null;
    let lastError = null;

    for (const modelName of modelCandidates) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: {
              systemInstruction: MASTER_SYSTEM_PROMPT,
              responseMimeType: "application/json",
            },
          });
          if (response) break;
        } catch (e) {
          lastError = e;
          console.warn(`[aiVerifier] Model ${modelName} attempt ${attempt + 1} failed (${e.message}).`);
          if (attempt < 1 && (e.message.includes("503") || e.message.includes("high demand") || e.message.includes("UNAVAILABLE"))) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastError || new Error("All Gemini model candidates failed.");
    }

    let rawText = response.text || "";
    rawText = rawText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();

    const result = JSON.parse(rawText);

    return {
      corroboration_score: typeof result.corroboration_score === "number" ? result.corroboration_score : 50,
      gravity_level: typeof result.gravity_level === "number" ? Math.min(5, Math.max(1, result.gravity_level)) : 3,
      verdict: ["CORROBORATED", "UNVERIFIED", "LIKELY_HOAX"].includes(result.verdict) ? result.verdict : "UNVERIFIED",
      summary_reasoning: result.summary_reasoning || "Analysis complete.",
      visual_damage_confirmed: Boolean(result.visual_damage_confirmed),
      official_alerts_found: Array.isArray(result.official_alerts_found) ? result.official_alerts_found : [],
      official_telemetry_summary: result.official_telemetry_summary || (officialTelemetry ? `${officialTelemetry.source}: ${officialTelemetry.official_warning_level || 'Active'}` : "N/A"),
      sources_cited: Array.isArray(result.sources_cited) ? result.sources_cited : [],
      recommended_relief_actions: {
        ndrf_assets: Array.isArray(result.recommended_relief_actions?.ndrf_assets)
          ? result.recommended_relief_actions.ndrf_assets
          : ["Standard Inspection Unit"],
        ngo_supplies: Array.isArray(result.recommended_relief_actions?.ngo_supplies)
          ? result.recommended_relief_actions.ngo_supplies
          : ["Food Packets", "Clean Water Cans", "First Aid Kits"],
      },
    };
  } catch (error) {
    console.error("[aiVerifier] Error during AI Verification:", error.message);
    return getFallbackResult(error.message);
  }
}

module.exports = {
  verifyIncidentReport,
};
