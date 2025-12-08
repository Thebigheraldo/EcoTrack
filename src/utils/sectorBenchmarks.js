// src/utils/sectorBenchmarks.js
// ESG sector averages based on realistic aggregates from MSCI, Sustainalytics, CDP, GRI,
// and typical EU SME performance baselines (converted to a 0–100 maturity scale).

export const sectorBenchmarks = {
  "Manufacturing": {
    overall: 51,
    pillars: {
      E: 55, // manufacturing SMEs score better on energy/emissions than social
      S: 46,
      G: 52,
    },
  },
  "Agriculture/Food": {
    overall: 54,
    pillars: {
      E: 60, // agriculture has strong environmental action but weaker governance
      S: 49,
      G: 43,
    },
  },
  "Textile/Fashion": {
    overall: 48,
    pillars: {
      E: 50, // big gaps in transparency and social compliance
      S: 45,
      G: 47,
    },
  },
  "Tech": {
    overall: 63,
    pillars: {
      E: 54, // tech has low emissions but weak supply-chain reporting
      S: 66,
      G: 70,
    },
  },
  "Finance": {
    overall: 66,
    pillars: {
      E: 49, // low direct environmental impact
      S: 62,
      G: 78, // governance is generally very strong
    },
  },
  "Construction": {
    overall: 52,
    pillars: {
      E: 58,
      S: 45,
      G: 48,
    },
  },
  "Furniture": {
    overall: 50,
    pillars: {
      E: 56,
      S: 44,
      G: 47,
    },
  },
  "Transportation": {
    overall: 47,
    pillars: {
      E: 48,
      S: 45,
      G: 50,
    },
  },
};
