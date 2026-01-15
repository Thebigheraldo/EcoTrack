// src/utils/suggestionEngine.js
// Ranking:
// 1) Sector match (exact + "*" only; case-insensitive)
// 2) Onboarding profile match (sizes/csrd/goals) — but DO NOT hard-exclude if profile is missing
// 3) Weakest ESG pillar inferred from answers/questions
// 4) High impact / low effort boosts

import { SUGGESTIONS as SUGGESTIONS_POOL } from "./suggestions";

/* ---------- helpers ---------- */
function safeUpper(v) {
  return (v == null ? "" : String(v)).toUpperCase();
}

function normalizeSectorName(v) {
  if (v == null) return "";
  let s = String(v);
  try {
    s = decodeURIComponent(s);
  } catch {}
  return s.trim();
}

function sectorKey(v) {
  return normalizeSectorName(v).toLowerCase();
}

function normalizeGoal(v) {
  return (v == null ? "" : String(v)).trim().toLowerCase();
}

function getAnswerScore(v) {
  if (v == null) return null;

  if (typeof v === "number") return v;

  if (typeof v === "object") {
    if (typeof v.score === "number") return v.score;
    if (typeof v.value === "number") return v.value;
    if (typeof v.points === "number") return v.points;
    if (typeof v.label === "string") {
      const t = v.label.toLowerCase();
      if (t === "na" || t === "n/a" || t === "unknown") return null;
      if (t === "no") return 0;
      if (t === "yes") return 3;
    }
    return null;
  }

  const s = String(v).toLowerCase();
  if (s === "na" || s === "n/a" || s === "unknown") return null;
  if (s === "no") return 0;
  if (s === "yes") return 3;
  return null;
}

function inferWorstPillar({ questions = [], answers = {} }) {
  const sums = { E: 0, S: 0, G: 0 };
  const counts = { E: 0, S: 0, G: 0 };

  for (const q of questions || []) {
    const id = q.id || q.qid || q.key;
    if (!id) continue;

    const pillar = safeUpper(q.pillar || q.esg || q.category || "");
    const p = pillar === "E" || pillar === "S" || pillar === "G" ? pillar : null;
    if (!p) continue;

    const score = getAnswerScore(answers[id]);
    if (typeof score !== "number") continue;

    sums[p] += score;
    counts[p] += 1;
  }

  const avgs = Object.entries(sums)
    .map(([p, sum]) => [p, counts[p] ? sum / counts[p] : null])
    .filter(([, avg]) => typeof avg === "number");

  if (!avgs.length) return null;

  avgs.sort((a, b) => a[1] - b[1]);
  return avgs[0][0];
}

/* ---------- onboarding normalization ---------- */
function sizeTierFromProfile(sizeRaw) {
  if (sizeRaw == null) return null;

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
    s.match(/\d+/g)?.map((x) => Number(x)).filter((x) => !Number.isNaN(x)) || [];
  if (nums.length) {
    const max = Math.max(...nums);
    if (max <= 10) return "micro";
    if (max <= 50) return "small";
    if (max <= 250) return "medium";
    return "large";
  }

  if (s.includes("250")) return "large";
  return null;
}

function isCsrdInScope(profile) {
  const v = profile?.csrdInScope ?? profile?.csrd ?? profile?.csrdScope;
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "yes" || s === "true" || s === "in scope") return true;
  return false;
}

function goalFromProfile(profile) {
  const g = profile?.goal ?? profile?.goals ?? profile?.primaryGoal;
  return normalizeGoal(g);
}

/* ---------- sector + metadata matching ---------- */
function matchesSector(s, sector) {
  const sec = sectorKey(sector);
  const sectors = (s.sectors || []).map(sectorKey);

  // if no sector provided, allow all
  if (!sec) return true;

  // strict include: exact or "*"/"All" (case-insensitive)
  return sectors.includes(sec) || sectors.includes("*") || sectors.includes("all");
}

function isExactSector(s, sector) {
  const sec = sectorKey(sector);
  if (!sec) return false;
  const sectors = (s.sectors || []).map(sectorKey);
  return sectors.includes(sec);
}

function matchesOnboarding(s, profile) {
  // Hard exclusions:
  if (s.csrdOnly && !isCsrdInScope(profile)) return false;

  // Sizes: if suggestion declares sizes, require match ONLY if profile size is known
  const tier = sizeTierFromProfile(profile?.size);
  if (Array.isArray(s.sizes) && s.sizes.length) {
    if (tier) {
      const allowed = s.sizes.map((x) => String(x).toLowerCase().trim());
      if (!allowed.includes(tier)) return false;
    }
    // if tier is missing, don't exclude (prevents empty dashboards)
  }

  // Goals: if suggestion declares goals, require match ONLY if profile goal is known
  const g = goalFromProfile(profile);
  if (Array.isArray(s.goals) && s.goals.length) {
    if (g) {
      const allowed = s.goals.map((x) => String(x).toLowerCase().trim());
      const ok = allowed.some((a) => g.includes(a) || a.includes(g));
      if (!ok) return false;
    }
    // if goal missing, don't exclude
  }

  return true;
}

/* ---------- scoring ---------- */
function scoreSuggestion(s, sector, worstPillar, profile) {
  let score = 0;

  const sec = sectorKey(sector);
  const sectors = (s.sectors || []).map(sectorKey);

  // Sector scoring:
  if (sectors.includes("*") || sectors.includes("all")) score += 2;
  if (sec && sectors.includes(sec)) score += 8;

  // Onboarding boosts:
  const tier = sizeTierFromProfile(profile?.size);
  if (
    tier &&
    Array.isArray(s.sizes) &&
    s.sizes.map((x) => String(x).toLowerCase().trim()).includes(tier)
  ) {
    score += 3;
  }

  const csrd = isCsrdInScope(profile);
  if (s.csrdOnly && csrd) score += 4;

  const g = goalFromProfile(profile);
  if (g && Array.isArray(s.goals) && s.goals.length) {
    const allowed = s.goals.map((x) => String(x).toLowerCase().trim());
    if (allowed.some((a) => g.includes(a) || a.includes(g))) score += 3;
  }

  // Worst pillar boost:
  if (worstPillar && safeUpper(s.pillar) === worstPillar) score += 5;

  // High impact / low effort boosts:
  const impact = (s.impact || "").toLowerCase();
  const effort = (s.effort || "").toLowerCase();
  if (impact.includes("high")) score += 2;
  if (effort.includes("low")) score += 1;

  // Furniture special-case (still works case-insensitive)
  if (sectorKey(sector) === "furniture") {
    const tags = (s.tags || []).map((t) => String(t).toLowerCase());
    if (
      tags.includes("fsc") ||
      tags.includes("pefc") ||
      tags.includes("wood") ||
      tags.includes("traceability")
    ) {
      score += 2;
    }
  }

  return score;
}

/**
 * Main export used by SuggestionsPage / DetailsPage / Dashboard
 */
export function getTailoredSuggestions({
  sector,
  questions,
  answers,
  profile = {},
  limit = 20,
}) {
  const worst = inferWorstPillar({ questions, answers });

  // 1) strict filter: sector-compatible only
  const sectorCandidates = SUGGESTIONS_POOL.filter((s) => matchesSector(s, sector));

  // 2) filter by onboarding constraints (csrdOnly / sizes / goals)
  const metaCandidates = sectorCandidates.filter((s) => matchesOnboarding(s, profile));

  // Split exact sector vs wildcard to prevent "*" drowning everything
  const exact = metaCandidates.filter((s) => isExactSector(s, sector));
  const wildcard = metaCandidates.filter((s) => !isExactSector(s, sector));

  const rank = (arr) =>
    arr
      .map((s) => ({
        ...s,
        _score: scoreSuggestion(s, sector, worst, profile),
      }))
      .sort((a, b) => b._score - a._score);

  const rankedExact = rank(exact);
  const rankedWild = rank(wildcard);

  const out = [];
  const exactQuota = rankedExact.length ? Math.ceil(limit * 0.7) : 0;

  out.push(...rankedExact.slice(0, exactQuota));
  out.push(...rankedWild.slice(0, Math.max(0, limit - out.length)));

  return out
    .slice(0, Math.max(1, limit))
    .map(({ _score, ...rest }) => rest);
}




