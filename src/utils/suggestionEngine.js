// src/utils/suggestionEngine.js
import { SUGGESTIONS as SUGGESTIONS_POOL } from "./suggestions";

/* ---------- basics ---------- */
function safeUpper(v) {
  return (v == null ? "" : String(v)).toUpperCase();
}
function normalizeText(v) {
  if (v == null) return "";
  let s = String(v);
  try { s = decodeURIComponent(s); } catch {}
  return s.trim();
}
function sectorKey(v) {
  return normalizeText(v).toLowerCase();
}
function normalizeGoal(v) {
  return normalizeText(v).toLowerCase();
}
function normalizePillar(v) {
  const p = safeUpper(v);
  return p === "E" || p === "S" || p === "G" ? p : null;
}

/* ---------- answer scoring ---------- */
function getAnswerScore(v) {
  if (v == null) return null;

  if (typeof v === "number" && !Number.isNaN(v)) return v;

  if (typeof v === "object") {
    if (typeof v.score === "number" && !Number.isNaN(v.score)) return v.score;
    if (typeof v.value === "number" && !Number.isNaN(v.value)) return v.value;
    if (typeof v.points === "number" && !Number.isNaN(v.points)) return v.points;

    const label = typeof v.label === "string" ? v.label.trim().toLowerCase() : "";
    if (label === "na" || label === "n/a" || label === "unknown") return null;
    if (label === "no") return 0;
    if (label === "yes") return 3;
    return null;
  }

  const s = String(v).trim().toLowerCase();
  if (s === "na" || s === "n/a" || s === "unknown") return null;
  if (s === "no") return 0;
  if (s === "yes") return 3;

  const n = Number(s);
  if (!Number.isNaN(n)) return n;

  return null;
}

function inferPillarAverages({ questions = [], answers = {} }) {
  const sums = { E: 0, S: 0, G: 0 };
  const counts = { E: 0, S: 0, G: 0 };

  for (const q of questions || []) {
    const id = q.id || q.qid || q.key;
    if (!id) continue;

    const p = normalizePillar(q.pillar || q.esg || q.category || "");
    if (!p) continue;

    const score = getAnswerScore(answers[id]);
    if (typeof score !== "number") continue;

    sums[p] += score;
    counts[p] += 1;
  }

  const out = { E: null, S: null, G: null };
  for (const p of ["E", "S", "G"]) {
    out[p] = counts[p] ? sums[p] / counts[p] : null;
  }
  return out;
}

export function inferWorstPillar({ questions = [], answers = {} }) {
  const avgs = inferPillarAverages({ questions, answers });
  const entries = Object.entries(avgs).filter(([, v]) => typeof v === "number");
  if (!entries.length) return null;
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

/* ---------- onboarding normalization ---------- */
function sizeTierFromProfile(sizeRaw) {
  if (sizeRaw == null || sizeRaw === "") return null;

  if (typeof sizeRaw === "number") {
    const n = sizeRaw;
    if (n <= 10) return "micro";
    if (n <= 50) return "small";
    if (n <= 250) return "medium";
    return "large";
  }

  const s = String(sizeRaw).toLowerCase().trim();
  if (s.includes("micro")) return "micro";
  if (s.includes("small")) return "small";
  if (s.includes("medium")) return "medium";
  if (s.includes("large")) return "large";

  const nums =
    s.match(/\d+/g)?.map(Number).filter((x) => !Number.isNaN(x)) || [];
  if (nums.length) {
    const max = Math.max(...nums);
    if (max <= 10) return "micro";
    if (max <= 50) return "small";
    if (max <= 250) return "medium";
    return "large";
  }

  return null;
}

function turnoverTierFromProfile(turnoverRaw) {
  if (turnoverRaw == null || turnoverRaw === "") return null;

  const parseMoney = (x) => {
    if (typeof x === "number" && !Number.isNaN(x)) return x;

    const s = String(x).toLowerCase().replace(/[, ]/g, "").trim();
    if (!s) return null;

    const hasM = s.includes("m") || s.includes("million");
    const hasK = s.includes("k") || s.includes("thousand");

    const nums =
      s.match(/\d+(\.\d+)?/g)?.map(Number).filter((v) => !Number.isNaN(v)) || [];
    if (!nums.length) return null;

    const base = Math.max(...nums);
    if (hasM) return base * 1_000_000;
    if (hasK) return base * 1_000;
    return base;
  };

  const n = parseMoney(turnoverRaw);
  if (typeof n !== "number" || Number.isNaN(n)) return null;

  if (n <= 2_000_000) return "micro";
  if (n <= 10_000_000) return "small";
  if (n <= 50_000_000) return "medium";
  return "large";
}

function timelineTierFromProfile(timelineRaw) {
  if (timelineRaw == null || timelineRaw === "") return null;
  const s = String(timelineRaw).toLowerCase().trim();

  if (s.includes("0-6") || s.includes("0–6")) return "0-6";
  if (s.includes("6-12") || s.includes("6–12")) return "6-12";
  if (s.includes("12+")) return "12+";
  if (s.includes("12")) return "12+";
  if (s.includes("quick")) return "0-6";

  const n = Number(s);
  if (!Number.isNaN(n)) {
    if (n <= 6) return "0-6";
    if (n <= 12) return "6-12";
    return "12+";
  }
  return null;
}

function timeframeTierFromSuggestion(timeframeRaw) {
  if (!timeframeRaw) return null;
  const s = String(timeframeRaw).toLowerCase().trim();
  if (s.includes("0-6") || s.includes("0–6")) return "0-6";
  if (s.includes("6-12") || s.includes("6–12")) return "6-12";
  if (s.includes("12+")) return "12+";
  if (s.includes("12")) return "12+";
  if (s.includes("quick")) return "0-6";
  return null;
}

function parseCsrdInScope(profile) {
  const raw =
    profile?.csrdInScope ??
    profile?.csrdScope ??
    profile?.csrd ??
    profile?.csrdStatus ??
    profile?.csrd_applicability;

  if (typeof raw === "boolean") return raw;

  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return null;

  if (s === "yes" || s === "true" || s.includes("in scope") || s.includes("applicable") || s.includes("required"))
    return true;

  if (s === "no" || s === "false" || s.includes("out of scope") || s.includes("not applicable") || s.includes("not required"))
    return false;

  return null;
}

function goalFromProfile(profile) {
  const g = profile?.goal ?? profile?.goals ?? profile?.primaryGoal;
  return normalizeGoal(g);
}

/* ---------- pillar selection ---------- */
function toPct(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  if (v >= 0 && v <= 1) return Math.round(v * 100);
  return Math.round(v);
}

function normalizePillarPercents(pillarPercents) {
  if (!pillarPercents || typeof pillarPercents !== "object") return null;

  const E = pillarPercents.E ?? pillarPercents.env ?? pillarPercents.environmental ?? null;
  const S = pillarPercents.S ?? pillarPercents.soc ?? pillarPercents.social ?? null;
  const G = pillarPercents.G ?? pillarPercents.gov ?? pillarPercents.governance ?? null;

  const out = { E: toPct(E), S: toPct(S), G: toPct(G) };
  if (out.E == null && out.S == null && out.G == null) return null;
  return out;
}

function pillarsBelowThreshold(pillarPercents, threshold) {
  const p = normalizePillarPercents(pillarPercents);
  if (!p) return [];
  const t = typeof threshold === "number" ? threshold : 50;

  const out = [];
  if (p.E != null && p.E < t) out.push("E");
  if (p.S != null && p.S < t) out.push("S");
  if (p.G != null && p.G < t) out.push("G");
  return out;
}

function lowestNPillarsByPercents(pillarPercents, n = 2) {
  const p = normalizePillarPercents(pillarPercents);
  if (!p) return [];
  const entries = Object.entries(p).filter(([, v]) => typeof v === "number");
  if (!entries.length) return [];
  entries.sort((a, b) => a[1] - b[1]);
  return entries.slice(0, Math.max(1, n)).map(([k]) => k);
}

function lowestNPillarsByAnswers({ questions, answers, n = 2 }) {
  const avgs = inferPillarAverages({ questions, answers });
  const entries = Object.entries(avgs).filter(([, v]) => typeof v === "number");
  if (!entries.length) return [];
  entries.sort((a, b) => a[1] - b[1]);
  return entries.slice(0, Math.max(1, n)).map(([k]) => k);
}

/* ---------- sector + onboarding constraints ---------- */
function matchesSector(s, sector) {
  const sec = sectorKey(sector);
  const sectors = (s.sectors || ["*"]).map(sectorKey);
  if (!sec) return true;
  return sectors.includes(sec) || sectors.includes("*") || sectors.includes("all");
}

function matchesOnboardingHard(s, profile) {
  // Only true hard rule: CSRD-only requires CSRD clearly true
  const csrd = parseCsrdInScope(profile);
  if (s.csrdOnly && csrd !== true) return false;

  // Size: hard filter only if suggestion declares sizes AND profile size is known
  const sizeTier = sizeTierFromProfile(profile?.size);
  if (Array.isArray(s.sizes) && s.sizes.length && sizeTier) {
    const allowed = s.sizes.map((x) => String(x).toLowerCase().trim());
    if (!allowed.includes(sizeTier)) return false;
  }

  return true;
}

/* ---------- scoring ---------- */
function scoreSuggestion(s, sector, profile, selectedPillars, worstPillar) {
  let score = 0;

  const sec = sectorKey(sector);
  const sectors = (s.sectors || ["*"]).map(sectorKey);

  // sector
  if (sectors.includes("*") || sectors.includes("all")) score += 2;
  if (sec && sectors.includes(sec)) score += 8;

  // selected pillars (primary)
  const sp = normalizePillar(s.pillar);
  if (sp && selectedPillars.includes(sp)) score += 8;

  // tie-break: weakest by answers
  if (worstPillar && sp === worstPillar) score += 2;

  // size soft boost
  const sizeTier = sizeTierFromProfile(profile?.size);
  if (sizeTier && Array.isArray(s.sizes) && s.sizes.map((x) => String(x).toLowerCase().trim()).includes(sizeTier)) {
    score += 2;
  }

  // turnover soft boost
  const turnTier = turnoverTierFromProfile(profile?.turnover);
  if (turnTier && Array.isArray(s.turnoverTiers) && s.turnoverTiers.map((x) => String(x).toLowerCase().trim()).includes(turnTier)) {
    score += 1;
  }

  // goal soft boost (DO NOT FILTER)
  const g = goalFromProfile(profile);
  if (g && Array.isArray(s.goals) && s.goals.length) {
    const allowed = s.goals.map((x) => String(x).toLowerCase().trim());
    const ok = allowed.some((a) => g.includes(a) || a.includes(g));
    if (ok) score += 2;
  }

  // timeline soft boost
  const tl = timelineTierFromProfile(profile?.timeline);
  const stl = timeframeTierFromSuggestion(s.timeframe);
  if (tl && stl && tl === stl) score += 2;

  // impact/effort
  const impact = (s.impact || "").toLowerCase();
  const effort = (s.effort || "").toLowerCase();
  if (impact.includes("high")) score += 2;
  if (effort.includes("low")) score += 1;

  // Furniture tags boost
  if (sectorKey(sector) === "furniture") {
    const tags = (s.tags || []).map((t) => String(t).toLowerCase());
    if (tags.includes("fsc") || tags.includes("pefc") || tags.includes("wood") || tags.includes("traceability")) {
      score += 2;
    }
  }

  return score;
}

function interleaveByPillar(ranked, pillars) {
  const wanted = (pillars || []).map(normalizePillar).filter(Boolean);
  if (wanted.length <= 1) return ranked;

  const buckets = { E: [], S: [], G: [] };
  for (const s of ranked) {
    const p = normalizePillar(s.pillar);
    if (p && buckets[p]) buckets[p].push(s);
  }

  const out = [];
  let added = true;
  while (added) {
    added = false;
    for (const p of wanted) {
      if (buckets[p]?.length) {
        out.push(buckets[p].shift());
        added = true;
      }
    }
  }
  return out.concat(buckets.E, buckets.S, buckets.G);
}

/**
 * Main export
 *
 * New behavior:
 * - If any pillar < threshold => select those pillars
 * - Else => select lowest N pillars by % (default N=2)
 * - If no pillar % available => select lowest N pillars by answers
 */
export function getTailoredSuggestions({
  sector,
  questions,
  answers,
  profile = {},
  limit = 20,
  pillarPercents = null,
  pillarThreshold = 50,
  fallbackLowestNPillars = 2,
}) {
  // candidates: sector + hard onboarding
  const sectorCandidates = SUGGESTIONS_POOL.filter((s) => matchesSector(s, sector));
  const metaCandidates = sectorCandidates.filter((s) => matchesOnboardingHard(s, profile));

  // select pillars
  let selected = pillarsBelowThreshold(pillarPercents, pillarThreshold);
  if (!selected.length) selected = lowestNPillarsByPercents(pillarPercents, fallbackLowestNPillars);
  if (!selected.length) selected = lowestNPillarsByAnswers({ questions, answers, n: fallbackLowestNPillars });

  // filter to selected pillars (if we have selection)
  let pillarCandidates = metaCandidates;
  if (selected.length) {
    const filtered = metaCandidates.filter((s) => {
      const p = normalizePillar(s.pillar);
      return p && selected.includes(p);
    });
    pillarCandidates = filtered.length ? filtered : metaCandidates;
  }

  // tie-break pillar from answers (optional)
  const worstByAnswers = inferWorstPillar({ questions, answers });

  // rank
  const ranked = pillarCandidates
    .map((s) => ({
      ...s,
      _score: scoreSuggestion(s, sector, profile, selected, worstByAnswers),
    }))
    .sort((a, b) => b._score - a._score);

  const finalRanked = selected.length > 1 ? interleaveByPillar(ranked, selected) : ranked;

  return finalRanked.slice(0, Math.max(1, limit)).map(({ _score, ...rest }) => rest);
}


