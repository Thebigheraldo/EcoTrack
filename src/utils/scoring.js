// src/utils/scoring.js

/* ===========================
   EcoTrack Professional Scoring
   ===========================
   - New: supports numeric answers { score: 0..4, label?: string }
   - Legacy: "Yes"=1, "No"=0, (optional) "Partial"=0.5
   - Unknown/blank: ignored by default (doesn't change denominators)
   - Per-question weights: q.weight (defaults to 1)
   - Per-sector pillar weights: E/S/G sums to 1
   - Critical questions: "No" caps that pillar (default 40%), "Unknown" can soft-cap
   - Overall score: weighted average of pillar scores using sector pillar weights
   - Outputs numeric scores (0–100) + letter rating (AAA..CCC)
 */

// -------------------------------
// Public API
// -------------------------------

/**
 * Compute ESG scores with sector weights, question weights, and critical caps.
 * @param {Array} questions [{ id, pillar?, category?, topic?, weight?, critical? }]
 * @param {Object} answers   {
 *   [id]:
 *     | "Yes"|"No"|"Partial"|"Unknown"
 *     | { score: number, label?: string }
 * }
 * @param {Object} opts      {
 *   sector?: string,
 *   treatUnknownAsZero?: boolean,      // default false (ignore unknown)
 *   allowPartial?: boolean,            // default false ("Partial"=0.5 when true)
 *   criticalCapNo?: number,            // default 0.40 (40%)
 *   criticalCapUnknown?: number,       // default 0.60 (60%)
 *   pillarWeightsOverride?: {E,S,G},   // optional custom pillar weights (sum=1)
 * }
 * @returns {{
 *   overall: number,                   // 0..100
 *   rating: string,                    // AAA..CCC
 *   pillars: { E:number, S:number, G:number }, // 0..100
 *   details: {
 *     pillar: {
 *       E:{ score:number, capped:boolean, capReason?:string, n:number, wSum:number },
 *       S:{ ... }, G:{ ... }
 *     },
 *     sectorPillarWeights: {E:number,S:number,G:number},
 *     unanswered: string[],            // question ids not counted
 *     criticalHits: {E:string[],S:string[],G:string[]}, // critical "No" ids
 *     criticalUnknowns: {E:string[],S:string[],G:string[]}, // critical unknown ids
 *   }
 * }}
 */
export function scoreAssessment(questions, answers, opts = {}) {
  const {
    sector,
    treatUnknownAsZero = false,
    allowPartial = false,
    criticalCapNo = 0.40,
    criticalCapUnknown = 0.60,
    pillarWeightsOverride,
  } = opts;

  const sectorPillarWeights = normalizePillarWeights(
    pillarWeightsOverride || getSectorPillarWeights(sector)
  );

  const buckets = {
    E: { sum: 0, w: 0, n: 0, criticalNo: [], criticalUnk: [] },
    S: { sum: 0, w: 0, n: 0, criticalNo: [], criticalUnk: [] },
    G: { sum: 0, w: 0, n: 0, criticalNo: [], criticalUnk: [] },
  };

  const unanswered = [];

  for (const q of questions || []) {
    const pillar = (q.pillar || pillarFromCategory(q.category)).toUpperCase();
    const bucket = buckets[pillar] || buckets.E; // default to E if unknown

    const weight = safeWeight(q.weight);
    const raw = convertAnswer(answers?.[q.id], { allowPartial, treatUnknownAsZero });

    if (raw === null) {
      // Unknown/blank and not treated as zero — exclude from denominator
      if (q.critical) bucket.criticalUnk.push(q.id);
      unanswered.push(q.id);
      continue;
    }

    bucket.sum += raw * weight; // raw is 0..1
    bucket.w += weight;
    bucket.n += 1;

    if (q.critical && raw === 0) {
      bucket.criticalNo.push(q.id);
    }
  }

  const pillars = {};
  const details = { pillar: { E: {}, S: {}, G: {} } };

  (["E", "S", "G"]).forEach((p) => {
    const b = buckets[p];
    const base = b.w > 0 ? (b.sum / b.w) : 0; // 0..1

    let cap = 1.0;
    let capped = false;
    let capReason;

    if (b.criticalNo.length) {
      cap = Math.min(cap, criticalCapNo);
      capped = true;
      capReason = `Critical "No" on ${b.criticalNo.length} item(s)`;
    } else if (b.criticalUnk.length) {
      cap = Math.min(cap, criticalCapUnknown);
      if (cap < 1) {
        capped = true;
        capReason = `Critical unanswered on ${b.criticalUnk.length} item(s)`;
      }
    }

    const score = Math.round(100 * Math.min(base, cap)); // 0..100

    pillars[p] = score;
    details.pillar[p] = {
      score,
      capped,
      capReason,
      n: b.n,
      wSum: round2(b.w),
    };
  });

  const overall0to1 =
    (pillars.E / 100) * sectorPillarWeights.E +
    (pillars.S / 100) * sectorPillarWeights.S +
    (pillars.G / 100) * sectorPillarWeights.G;

  const overall = Math.round(overall0to1 * 100); // 0..100
  const rating = numericToRating(overall);

  return {
    overall,
    rating,
    pillars,
    details: {
      pillar: details.pillar,
      sectorPillarWeights,
      unanswered,
      criticalHits: {
        E: buckets.E.criticalNo,
        S: buckets.S.criticalNo,
        G: buckets.G.criticalNo,
      },
      criticalUnknowns: {
        E: buckets.E.criticalUnk,
        S: buckets.S.criticalUnk,
        G: buckets.G.criticalUnk,
      },
    },
  };
}

// -------------------------------
// Utilities & Helpers
// -------------------------------

export function pillarFromCategory(cat) {
  if (cat === "Environmental") return "E";
  if (cat === "Social") return "S";
  if (cat === "Governance") return "G";
  return "E";
}

/**
 * Convert answer to 0..1 or null.
 * Supports:
 *  - numeric format: { score: 0..4, ... }  -> score/4
 *  - legacy strings: "Yes"|"No"|"Partial"|"Unknown"
 */
function convertAnswer(v, { allowPartial, treatUnknownAsZero }) {
  // New numeric format: { score: 0..4 }
  if (v && typeof v === "object" && typeof v.score === "number") {
    let s = v.score;
    if (s < 0) s = 0;
    if (s > 4) s = 4;
    return s / 4; // normalize 0..4 -> 0..1
  }

  // Legacy string format
  if (v === "Yes") return 1;
  if (v === "No") return 0;
  if (allowPartial && v === "Partial") return 0.5;

  if (
    treatUnknownAsZero &&
    (v === "Unknown" || v === undefined || v === null || v === "")
  ) {
    return 0;
  }

  // Unknown/blank -> null (ignored)
  return null;
}

function safeWeight(w) {
  const x = Number(w);
  if (!isFinite(x) || x <= 0) return 1;
  return x;
}

function normalizePillarWeights(w) {
  const E = Number(w?.E ?? 1);
  const S = Number(w?.S ?? 1);
  const G = Number(w?.G ?? 1);
  const sum = E + S + G;
  if (sum <= 0) return { E: 1 / 3, S: 1 / 3, G: 1 / 3 };
  return { E: E / sum, S: S / sum, G: G / sum };
}

export function numericToRating(x) {
  if (x >= 85) return "AAA";
  if (x >= 75) return "AA";
  if (x >= 65) return "A";
  if (x >= 55) return "BBB";
  if (x >= 45) return "BB";
  if (x >= 35) return "B";
  return "CCC";
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// -------------------------------
// Sector pillar weights (defaults)
// -------------------------------
export function getSectorPillarWeights(sector) {
  const s = (sector || "").toLowerCase();

  if (matchOne(s, ["manufacturing", "construction", "chemicals", "mining"])) {
    return { E: 0.50, S: 0.30, G: 0.20 };
  }
  if (matchOne(s, ["textile", "fashion", "apparel", "furniture"])) {
    return { E: 0.45, S: 0.35, G: 0.20 };
  }
  if (matchOne(s, ["agriculture", "food", "beverage"])) {
    return { E: 0.50, S: 0.35, G: 0.15 };
  }
  if (matchOne(s, ["transport", "transportation", "logistics"])) {
    return { E: 0.50, S: 0.30, G: 0.20 };
  }
  if (matchOne(s, ["tech", "technology", "software", "it"])) {
    return { E: 0.25, S: 0.35, G: 0.40 };
  }
  if (matchOne(s, ["finance", "bank", "insurance", "asset"])) {
    return { E: 0.20, S: 0.30, G: 0.50 };
  }

  return { E: 0.34, S: 0.33, G: 0.33 };
}

function matchOne(s, arr) {
  return arr.some((k) => s.includes(k));
}


