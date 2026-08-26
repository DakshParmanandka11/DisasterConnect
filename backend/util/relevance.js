// Heuristic disaster relevance & gibberish analyzer for calamity reports

const CALAMITY_KEYWORDS = [
  "flood", "waterlog", "inundated", "drowning", "submerged",
  "fire", "blaze", "burn", "wildfire", "smoke",
  "earthquake", "tremor", "quake", "aftershock",
  "landslide", "mudslide", "avalanche", "rockfall",
  "cyclone", "storm", "hurricane", "typhoon", "tornado", "heavy rain", "tsunami",
  "rescue", "trapped", "help", "sos", "emergency", "evacuate", "evacuation",
  "collapse", "structural damage", "building collapse", "bridge collapse",
  "power outage", "blackout", "electric wire", "short circuit",
  "medical", "ambulance", "blood", "injured", "casualty", "hospital", "doctor",
  "food", "clean water", "ration", "shelter", "blanket", "relief", "starving",
  "road blocked", "stranded", "dam breach", "overflow", "gas leak"
];

function analyzeRelevance(title = "", description = "") {
  const combined = `${title} ${description}`.trim().toLowerCase();
  if (!combined) {
    return {
      isGibberish: true,
      relevanceScore: 0,
      gibberishScore: 100,
      reasons: ["Empty post content"],
      detectedKeywords: []
    };
  }

  const words = combined.split(/\s+/).filter(Boolean);
  let gibberishScore = 0;
  const reasons = [];

  // 1. Check for keyboard mashing or random long non-word character sequences (e.g. asdfghjkl, qwertyuiop, zxcvbnm)
  const mashPattern = /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwert|werty|ertyu|rtyui|tyuio|yuiop|zxcvb|xcvbn|cvbnm|12345|23456)/i;
  if (mashPattern.test(combined)) {
    gibberishScore += 40;
    reasons.push("Contains common keyboard-mash sequence");
  }

  // 2. Check for repeated character sequences (e.g. "aaaaaaaa", "hhhhhhh")
  const repeatCharPattern = /(.)\1{4,}/;
  if (repeatCharPattern.test(combined)) {
    gibberishScore += 30;
    reasons.push("Excessive repeating characters");
  }

  // 3. Check average word length (extremely long pseudo-words like "asdfghjklzxcvbnmqwertyuiop")
  const longWords = words.filter(w => w.length > 22);
  if (longWords.length > 0) {
    gibberishScore += 35;
    reasons.push("Contains unnaturally long gibberish strings");
  }

  // 4. Check dictionary / consonant cluster ratio (words with 5+ consonants in a row without vowels)
  const excessiveConsonantsPattern = /[^aeiouy\d\s]{6,}/i;
  if (excessiveConsonantsPattern.test(combined)) {
    gibberishScore += 30;
    reasons.push("Unnatural consonant cluster detected");
  }

  // 5. Match calamity keywords
  const detectedKeywords = CALAMITY_KEYWORDS.filter(kw => combined.includes(kw));

  let relevanceScore = 40; // baseline neutral
  if (detectedKeywords.length > 0) {
    relevanceScore += Math.min(60, detectedKeywords.length * 20);
  }

  // Adjust relevance based on gibberish penalty
  if (gibberishScore >= 50) {
    relevanceScore = Math.max(5, relevanceScore - gibberishScore);
  }

  const isGibberish = gibberishScore >= 50;

  return {
    isGibberish,
    relevanceScore: Math.min(100, Math.max(0, relevanceScore)),
    gibberishScore: Math.min(100, Math.max(0, gibberishScore)),
    reasons,
    detectedKeywords
  };
}

module.exports = { analyzeRelevance, CALAMITY_KEYWORDS };
