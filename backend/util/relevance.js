// Heuristic disaster relevance, gibberish, spam & duplicate analyzer for calamity reports

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
  "road blocked", "stranded", "dam breach", "overflow", "gas leak",
  "explosion", "blast", "chemical spill", "toxic", "debris", "rubble",
  "missing person", "bodies", "dead", "fatality", "critical",
];

const SPAM_PATTERNS = [
  /!{3,}/,          // three or more exclamation marks
  /\?{3,}/,         // three or more question marks
  /(.)\1{5,}/,      // 6+ repeating chars
  /OMG|WTF|LOL|LMAO/i,
  /[A-Z]{8,}/,      // 8+ consecutive uppercase letters
  /\b(click here|buy now|sale|discount|promo|free money|earn cash)\b/i,
  /http[s]?:\/\//,  // URLs in disaster reports are suspicious
];

function analyzeRelevance(title = "", description = "", existingReports = []) {
  const combined = `${title} ${description}`.trim().toLowerCase();
  if (!combined) {
    return {
      isGibberish: true,
      relevanceScore: 0,
      gibberishScore: 100,
      spamScore: 100,
      duplicateProbability: 0,
      locationConfidence: "None",
      overallConfidence: 0,
      reasons: ["Empty post content"],
      detectedKeywords: [],
      flags: ["Empty content — no information provided"],
    };
  }

  const words = combined.split(/\s+/).filter(Boolean);
  let gibberishScore = 0;
  let spamScore = 0;
  const reasons = [];
  const flags = [];

  // ── Gibberish Detection ──

  // 1. Keyboard mashing patterns
  const mashPattern = /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwert|werty|ertyu|rtyui|tyuio|yuiop|zxcvb|xcvbn|cvbnm|12345|23456)/i;
  if (mashPattern.test(combined)) {
    gibberishScore += 40;
    reasons.push("Contains common keyboard-mash sequence");
    flags.push("Keyboard mashing detected in text");
  }

  // 2. Repeated character sequences
  const repeatCharPattern = /(.)\\1{4,}/;
  if (repeatCharPattern.test(combined) || /(.)(\1){4,}/.test(combined)) {
    gibberishScore += 30;
    reasons.push("Excessive repeating characters");
    flags.push("Repetitive character spam detected");
  }

  // 3. Unnaturally long words
  const longWords = words.filter((w) => w.length > 22);
  if (longWords.length > 0) {
    gibberishScore += 35;
    reasons.push("Contains unnaturally long gibberish strings");
    flags.push("Non-human text pattern: extremely long words");
  }

  // 4. Consonant clusters
  const excessiveConsonantsPattern = /[^aeiouy\d\s]{6,}/i;
  if (excessiveConsonantsPattern.test(combined)) {
    gibberishScore += 30;
    reasons.push("Unnatural consonant cluster detected");
  }

  // ── Spam Detection ──

  let spamHits = 0;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(`${title} ${description}`)) {
      spamHits++;
    }
  }

  // Excessive exclamation / question spam
  const exclamCount = (combined.match(/!/g) || []).length;
  const capsRatio = (combined.match(/[A-Z]/g) || []).length / Math.max(1, combined.replace(/\s/g, "").length);

  if (exclamCount >= 5) {
    spamScore += 30;
    flags.push("Excessive exclamation marks — may indicate panic post or spam");
  }
  if (capsRatio > 0.5 && combined.length > 20) {
    spamScore += 25;
    flags.push("Unusually high proportion of uppercase text");
  }
  spamScore += spamHits * 20;
  spamScore = Math.min(100, spamScore);

  // ── Relevance Scoring ──

  const detectedKeywords = CALAMITY_KEYWORDS.filter((kw) => combined.includes(kw));

  let relevanceScore = 40; // baseline neutral
  if (detectedKeywords.length > 0) {
    relevanceScore += Math.min(60, detectedKeywords.length * 20);
    flags.push(`Disaster-related keywords detected: ${detectedKeywords.slice(0, 3).join(", ")}`);
  } else {
    flags.push("No disaster-related keywords found in content");
  }

  // Description quality signals
  if (description && description.length > 80) {
    relevanceScore += 5;
    flags.push("Description contains meaningful incident information");
  }

  // Adjust relevance based on gibberish
  if (gibberishScore >= 50) {
    relevanceScore = Math.max(5, relevanceScore - gibberishScore);
  }

  const isGibberish = gibberishScore >= 50;

  // ── Duplicate Probability ──

  let duplicateProbability = 0;
  if (existingReports && existingReports.length > 0) {
    const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    for (const r of existingReports) {
      if (!r.title) continue;
      const rTitle = r.title.toLowerCase();
      const matchCount = titleWords.filter((w) => rTitle.includes(w)).length;
      const similarity = titleWords.length > 0 ? (matchCount / titleWords.length) : 0;
      if (similarity > 0.6) {
        duplicateProbability = Math.max(duplicateProbability, Math.round(similarity * 100));
      }
    }
    if (duplicateProbability > 50) {
      flags.push(`High similarity to an existing report detected (${duplicateProbability}% match)`);
    }
  }

  // ── Location Confidence ──
  // This is evaluated externally but we default to indicating if GPS available
  const locationConfidence = "High"; // caller passes coords; we mark High by default

  // ── Overall Confidence ──
  const overallConfidence = Math.round(
    (relevanceScore * 0.5) +
    ((100 - spamScore) * 0.25) +
    ((100 - gibberishScore) * 0.25)
  );

  return {
    isGibberish,
    relevanceScore: Math.min(100, Math.max(0, relevanceScore)),
    gibberishScore: Math.min(100, Math.max(0, gibberishScore)),
    spamScore: Math.min(100, Math.max(0, spamScore)),
    duplicateProbability: Math.min(100, Math.max(0, duplicateProbability)),
    locationConfidence,
    overallConfidence: Math.min(100, Math.max(0, overallConfidence)),
    reasons,
    detectedKeywords,
    flags,
  };
}

module.exports = { analyzeRelevance, CALAMITY_KEYWORDS };
