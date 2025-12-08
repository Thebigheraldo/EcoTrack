// src/utils/suggestions.js

// Mini pool d’esempio. Aggiungi pure 30–40 voci qui.
// Campi chiave: sectors (array), size (array opz.), csrdOnly (bool), goals (array opz.), tags (array)
export const SUGGESTIONS = [
  {
    id: "E-ppas-001",
    text: "Switch to renewable electricity (PPA or green tariff) with a 12–24 month roadmap.",
    sectors: ["Manufacturing", "Textile/Fashion", "Tech", "Furniture"],
    tags: ["energy", "scope2", "quick-win"],
  },
  {
    id: "E-led-002",
    text: "Complete LED retrofit and add smart occupancy sensors in warehouses and offices.",
    sectors: ["Manufacturing", "Construction", "Furniture", "Transportation"],
    tags: ["energy-efficiency", "OPEX↓"],
  },
  {
    id: "E-meter-003",
    text: "Install sub-metering and monthly energy KPI dashboard (kWh/unit, kWh/m²).",
    sectors: ["Manufacturing", "Textile/Fashion", "Agriculture/Food"],
    tags: ["metrics", "energy"],
  },
  {
    id: "S-wellbeing-101",
    text: "Adopt an Employee Wellbeing program (flex hours, EAP, burnout prevention).",
    sectors: ["Manufacturing", "Tech", "Finance", "Textile/Fashion", "Furniture"],
    tags: ["people", "policy"],
  },
  {
    id: "S-supply-102",
    text: "Create a Supplier Code of Conduct and do risk-tiering (Tier1/Tier2) with annual checks.",
    sectors: ["Textile/Fashion", "Manufacturing", "Agriculture/Food"],
    tags: ["supply-chain", "human-rights"],
  },
  {
    id: "G-policy-201",
    text: "Approve a Sustainability Policy at board level and assign ESG ownership (RACI).",
    sectors: ["All"],
    tags: ["governance", "foundations"],
  },
  {
    id: "G-report-202",
    text: "Publish an annual ESG summary on your website with 5–8 core KPIs.",
    sectors: ["All"],
    tags: ["transparency", "communication"],
  },
  {
    id: "E-water-004",
    text: "Run a water-use audit and set reduction targets per process step.",
    sectors: ["Manufacturing", "Agriculture/Food", "Textile/Fashion"],
    tags: ["water", "metrics"],
  },
  {
    id: "E-waste-005",
    text: "Introduce waste segregation KPIs and a take-back contract for key materials.",
    sectors: ["Manufacturing", "Furniture", "Construction"],
    tags: ["waste", "circularity"],
  },
  {
    id: "S-training-103",
    text: "Train 100% staff on ethics & anti-corruption; track completion quarterly.",
    sectors: ["All"],
    tags: ["training", "ethics"],
  },
  {
    id: "G-supplier-203",
    text: "Add ESG clauses in purchase contracts and include right-to-audit.",
    sectors: ["Manufacturing", "Textile/Fashion", "Agriculture/Food"],
    tags: ["governance", "procurement"],
  },
  {
    id: "E-logistics-006",
    text: "Optimize logistics: modal shift where feasible and load-factor KPI by route.",
    sectors: ["Transportation", "Manufacturing", "Furniture"],
    tags: ["scope3", "logistics"],
  },
];

// Filtra per settore; opzionalmente puoi estendere a size, goals, ecc.
export function filterSuggestions({ sector }) {
  if (!sector) return SUGGESTIONS;
  return SUGGESTIONS.filter(s =>
    s.sectors.includes("All") || s.sectors.includes(sector)
  );
}

// Estrai n elementi random senza ripetizioni
export function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}
