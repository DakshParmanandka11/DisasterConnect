const axios = require("axios");

/**
 * Fetches live web snippets and ground truth for a disaster report using Tavily Search API.
 * @param {Object|string} params - { location, disasterType } or location string
 * @param {string} [typeParam] - disasterType string if positional params used
 * @returns {Promise<Array<{title: string, url: string, content: string}>>}
 */
async function fetchLiveGroundTruth(params, typeParam) {
  try {
    let location = "";
    let disasterType = "";

    if (typeof params === "object" && params !== null) {
      location = params.location || params.title || "India";
      disasterType = params.disasterType || params.category || params.type || "disaster";
    } else {
      location = params || "India";
      disasterType = typeParam || "disaster";
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("[webSearch] TAVILY_API_KEY missing. Skipping live web retrieval.");
      return [];
    }

    const queries = [
      `"${location} ${disasterType} IMD OR SDRF OR NDMA alert warning today"`,
      `"${location} ${disasterType} news updates today"`,
      `"${location} ${disasterType} twitter OR video ground reports"`,
    ];

    const searchPromises = queries.map(async (query) => {
      try {
        const res = await axios.post(
          "https://api.tavily.com/search",
          {
            api_key: apiKey,
            query: query,
            search_depth: "basic",
            days: 2,
            max_results: 3,
          },
          { timeout: 7000 }
        );
        return res.data && Array.isArray(res.data.results) ? res.data.results : [];
      } catch (err) {
        console.warn(`[webSearch] Tavily query failed for "${query}":`, err.message);
        return [];
      }
    });

    const resultsArray = await Promise.all(searchPromises);
    const combined = resultsArray.flat();

    const seenUrls = new Set();
    const deduplicated = [];

    for (const item of combined) {
      if (item && item.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        deduplicated.push({
          title: item.title || "Web Source",
          url: item.url,
          content: item.content || item.snippet || "",
        });
      }
    }

    return deduplicated.slice(0, 8);
  } catch (error) {
    console.error("[webSearch] Error executing live web search:", error.message);
    return [];
  }
}

module.exports = {
  fetchLiveGroundTruth,
};
