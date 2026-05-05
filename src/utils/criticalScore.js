// src/utils/criticalScore.js

export const CRITICAL_PILLAR_THRESHOLD = 20;
export const WEAK_PILLAR_THRESHOLD = 40;
export const IMBALANCE_GAP_THRESHOLD = 35;

function isValidNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

export function evaluateCriticalScore(pillarScores = {}) {
  const scores = {
    Environmental: pillarScores.Environmental,
    Social: pillarScores.Social,
    Governance: pillarScores.Governance,
  };

  const validEntries = Object.entries(scores).filter(([, score]) =>
    isValidNumber(score)
  );

  if (validEntries.length < 3) {
    return {
      level: "incomplete",
      hideOverallScore: true,
      criticalPillars: [],
      weakPillars: [],
      message:
        "The assessment is incomplete, so EcoTrack cannot calculate a reliable ESG score.",
    };
  }

  const criticalPillars = validEntries
    .filter(([, score]) => score <= CRITICAL_PILLAR_THRESHOLD)
    .map(([pillar]) => pillar);

  const weakPillars = validEntries
    .filter(
      ([, score]) =>
        score > CRITICAL_PILLAR_THRESHOLD && score <= WEAK_PILLAR_THRESHOLD
    )
    .map(([pillar]) => pillar);

  const scoreValues = validEntries.map(([, score]) => score);
  const highestScore = Math.max(...scoreValues);
  const lowestScore = Math.min(...scoreValues);
  const imbalanceGap = highestScore - lowestScore;

  if (criticalPillars.length > 0) {
    return {
      level: "critical",
      hideOverallScore: true,
      criticalPillars,
      weakPillars,
      imbalanceGap,
      message:
        "One or more ESG pillars are critically low. EcoTrack hides the overall score because an average would give a misleading view of ESG maturity.",
    };
  }

  if (weakPillars.length > 0) {
    return {
      level: "weak",
      hideOverallScore: false,
      criticalPillars: [],
      weakPillars,
      imbalanceGap,
      message:
        "One or more ESG pillars are weak and should be prioritized before presenting the company as ESG mature.",
    };
  }

  if (imbalanceGap >= IMBALANCE_GAP_THRESHOLD) {
    return {
      level: "imbalanced",
      hideOverallScore: false,
      criticalPillars: [],
      weakPillars: [],
      imbalanceGap,
      message:
        "The ESG profile is unbalanced. One pillar is significantly weaker than the others and should be reviewed.",
    };
  }

  return {
    level: "normal",
    hideOverallScore: false,
    criticalPillars: [],
    weakPillars: [],
    imbalanceGap,
    message: null,
  };
}