// src/utils/criticalGuard.js
export const DEFAULT_CRITICAL_THRESHOLD = 0.2; // 20%

/**
 * pillarScores must be normalized 0..1, e.g. { E: 0.62, S: 0.45, G: 0.71 }
 */
export function hasCriticalPillar(pillarScores, threshold = DEFAULT_CRITICAL_THRESHOLD) {
  const { E = 1, S = 1, G = 1 } = pillarScores || {};
  return E <= threshold || S <= threshold || G <= threshold;
}
