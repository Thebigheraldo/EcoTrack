// src/utils/suggestions.js
// Single source of truth for ALL suggestions.
//
// ✅ New schema fields used for tailoring:
// - sectors: ["Furniture"] or ["*"]
// - sizes: ["micro","small","medium","large"] (optional)
// - csrdOnly: true/false (optional; when true, only show if CSRD in scope)
// - goals: ["compliance","cost","decarbonization","customer","risk","finance"] (optional)
// - priorityTags: extra tags used for scoring boosts (optional)
//
// NOTE: Keep your current fields too (pillar/title/text/tags/impact/effort/timeframe)
// so UI + action plan keep working unchanged.

export const SUGGESTIONS = [
  // ---------------------------
  // GLOBAL FOUNDATIONS (ALL)
  // ---------------------------
  {
    id: "g-esg-owner-cadence",
    pillar: "G",
    title: "Assign ESG ownership and a monthly cadence",
    text: "Nominate an ESG owner, define responsibilities, and hold a monthly 30-minute review with action items.",
    tags: ["governance", "foundations", "policy", "reporting"],
    sectors: ["*"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["compliance", "risk", "finance", "customer"],
    sizes: ["micro", "small", "medium", "large"],
  },
  {
    id: "g-data-register",
    pillar: "G",
    title: "Create an ESG data register",
    text: "List KPIs, owners, sources, frequency, and evidence. This reduces spreadsheet chaos and prepares you for audits.",
    tags: ["reporting", "metrics", "transparency"],
    sectors: ["*"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["compliance", "finance", "risk"],
  },
  {
    id: "g-code-of-conduct",
    pillar: "G",
    title: "Publish a code of conduct + acknowledgement",
    text: "Create a short code of conduct and require acknowledgement from employees and key suppliers.",
    tags: ["policy", "ethics", "compliance"],
    sectors: ["*"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["compliance", "risk", "customer"],
  },
  {
    id: "s-training-plan",
    pillar: "S",
    title: "Create an annual training plan",
    text: "Define 3–5 priority training topics and track attendance and outcomes quarterly.",
    tags: ["training", "people", "wellbeing"],
    sectors: ["*"],
    impact: "Medium",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["risk", "customer"],
  },
  {
    id: "e-energy-audit",
    pillar: "E",
    title: "Run a basic energy audit",
    text: "Map your top 3 energy-consuming processes and set a quarterly reduction target with one quick win.",
    tags: ["energy", "energy-efficiency", "metering"],
    sectors: ["*"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["cost", "decarbonization", "risk"],
  },
  {
    id: "e-led-occupancy",
    pillar: "E",
    title: "LED + occupancy sensors rollout",
    text: "Replace legacy lighting and add occupancy sensors in low-use spaces; track kWh reduction monthly.",
    tags: ["lighting", "energy-efficiency"],
    sectors: ["*"],
    impact: "Medium",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["cost", "decarbonization"],
    sizes: ["micro", "small", "medium", "large"],
  },

  // ---------------------------
  // CSRD / COMPLIANCE (ONLY IF CSRD IN SCOPE)
  // ---------------------------
  {
    id: "csrd-double-materiality",
    pillar: "G",
    title: "Run a lightweight Double Materiality Assessment",
    text: "Identify your top ESG impacts and financial risks, validate with 5–10 stakeholders, and document the rationale.",
    tags: ["csrd", "esrs", "materiality", "reporting", "compliance"],
    sectors: ["*"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    csrdOnly: true,
    goals: ["compliance", "finance", "risk"],
    sizes: ["medium", "large"],
  },
  {
    id: "csrd-esrs-gap",
    pillar: "G",
    title: "Do an ESRS gap assessment + evidence map",
    text: "Map what you already have vs ESRS requirements and define what evidence you can realistically collect first.",
    tags: ["csrd", "esrs", "reporting", "evidence", "compliance"],
    sectors: ["*"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    csrdOnly: true,
    goals: ["compliance"],
    sizes: ["medium", "large"],
  },
  {
    id: "csrd-assurance-readiness",
    pillar: "G",
    title: "Prepare for limited assurance (audit-ready evidence)",
    text: "Define controls for 10–15 key KPIs, set document retention rules, and run an internal evidence check.",
    tags: ["csrd", "assurance", "audit", "controls", "compliance"],
    sectors: ["*"],
    impact: "High",
    effort: "High",
    timeframe: "12+ months",
    csrdOnly: true,
    goals: ["compliance", "risk"],
    sizes: ["large", "medium"],
  },

  // ---------------------------
  // MANUFACTURING
  // ---------------------------
  {
    id: "mfg-submetering",
    pillar: "E",
    title: "Install sub-metering + KPI dashboard (kWh/unit)",
    text: "Add sub-meters to high-load areas and track energy intensity monthly (kWh/unit, kWh/m²).",
    tags: ["energy", "metering", "metrics"],
    sectors: ["Manufacturing"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["cost", "decarbonization"],
    sizes: ["small", "medium", "large"],
  },
  {
    id: "mfg-waste-streams",
    pillar: "E",
    title: "Separate and measure waste streams",
    text: "Track waste by type (recyclable, residual, hazardous) and set reduction targets per line.",
    tags: ["waste", "circularity", "recycling", "metrics"],
    sectors: ["Manufacturing"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["cost", "risk", "customer"],
  },
  {
    id: "mfg-chem-inventory",
    pillar: "E",
    title: "Create a chemicals inventory + substitution list",
    text: "List chemicals, usage, storage, and alternatives; train handling basics and document SDS availability.",
    tags: ["chemicals", "compliance", "risk"],
    sectors: ["Manufacturing"],
    impact: "Medium",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "compliance"],
  },
  {
    id: "mfg-hs-nearmiss",
    pillar: "S",
    title: "Near-miss reporting + corrective actions",
    text: "Track near-misses and corrective actions; review monthly with owners and log closure dates.",
    tags: ["health-safety", "people", "safety"],
    sectors: ["Manufacturing"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["risk", "customer"],
  },

  // ---------------------------
  // AGRICULTURE / FOOD
  // ---------------------------
  {
    id: "agri-water-map",
    pillar: "E",
    title: "Create a water-use map + hotspots",
    text: "Identify where water is used, reused, and discharged; flag biggest risks, costs, and compliance points.",
    tags: ["water", "risk", "metrics"],
    sectors: ["Agriculture/Food"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["risk", "cost", "compliance"],
  },
  {
    id: "agri-foodwaste-kpi",
    pillar: "E",
    title: "Measure food loss & waste + reduction targets",
    text: "Measure food loss and waste at key steps and set reduction targets; start with one product line.",
    tags: ["waste", "metrics", "circularity"],
    sectors: ["Agriculture/Food"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["cost", "customer", "risk"],
  },
  {
    id: "agri-supplier-labor",
    pillar: "S",
    title: "Supplier labor expectations + grievance path",
    text: "Add labor expectations and a grievance path for seasonal workers and contractors; document responses.",
    tags: ["human-rights", "labor", "procurement"],
    sectors: ["Agriculture/Food"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "customer", "compliance"],
  },

  // ---------------------------
  // TEXTILE / FASHION
  // ---------------------------
  {
    id: "textile-chem-mrsl",
    pillar: "E",
    title: "Create a chemical compliance baseline (MRSL mindset)",
    text: "List chemicals used, identify high-risk substances, and start a substitution plan for the top 3 risks.",
    tags: ["chemicals", "compliance", "risk"],
    sectors: ["Textile/Fashion"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["compliance", "customer", "risk"],
  },
  {
    id: "textile-water-audit",
    pillar: "E",
    title: "Water-use audit + targets per process step",
    text: "Run a water-use audit (dyeing/finishing) and set reduction targets per process step.",
    tags: ["water", "metrics"],
    sectors: ["Textile/Fashion"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["cost", "risk", "customer"],
  },
  {
    id: "textile-supplier-code",
    pillar: "S",
    title: "Supplier code + risk-tiering (Tier1/Tier2)",
    text: "Create a supplier code of conduct and do risk-tiering; start annual checks for high-risk suppliers.",
    tags: ["human-rights", "procurement", "supply-chain"],
    sectors: ["Textile/Fashion"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "customer", "compliance"],
  },

  // ---------------------------
  // TECH
  // ---------------------------
  {
    id: "tech-cloud-emissions",
    pillar: "E",
    title: "Measure cloud/IT emissions + quick reductions",
    text: "Estimate cloud/IT footprint, enable autoscaling, reduce idle resources, and set monthly optimization targets.",
    tags: ["energy", "carbon", "metrics", "scope2"],
    sectors: ["Tech"],
    impact: "Medium",
    effort: "Medium",
    timeframe: "0–6 months",
    goals: ["cost", "decarbonization"],
    sizes: ["micro", "small", "medium", "large"],
  },
  {
    id: "tech-privacy-governance",
    pillar: "G",
    title: "Strengthen privacy & data governance basics",
    text: "Define data retention, access control, and incident response roles; document 5 key controls and review quarterly.",
    tags: ["governance", "risk", "policy", "compliance"],
    sectors: ["Tech"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "customer", "compliance"],
  },

  // ---------------------------
  // FINANCE
  // ---------------------------
  {
    id: "fin-esg-risk-screen",
    pillar: "G",
    title: "Introduce ESG risk screening for clients/portfolio",
    text: "Define simple ESG risk flags, document escalation rules, and apply to new onboarding or renewals first.",
    tags: ["governance", "risk", "policy", "compliance"],
    sectors: ["Finance"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "compliance", "finance"],
    sizes: ["small", "medium", "large"],
  },
  {
    id: "fin-anti-bribery-training",
    pillar: "G",
    title: "Anti-bribery controls + staff training completion",
    text: "Define gifts/hospitality rules, approval thresholds, and train staff; track completion quarterly.",
    tags: ["anti-bribery", "anticorruption", "training", "compliance"],
    sectors: ["Finance"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["compliance", "risk"],
  },

  // ---------------------------
  // CONSTRUCTION
  // ---------------------------
  {
    id: "con-site-waste",
    pillar: "E",
    title: "Site waste segregation + tracking",
    text: "Separate site waste streams and track volumes monthly; set targets for top material categories.",
    tags: ["waste", "recycling", "circularity", "metrics"],
    sectors: ["Construction"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["cost", "customer", "risk"],
  },
  {
    id: "con-hs-toolbox",
    pillar: "S",
    title: "Toolbox talks + incident tracking",
    text: "Standardize weekly toolbox talks and track incidents, near-misses, and corrective actions with owners.",
    tags: ["health-safety", "people", "safety"],
    sectors: ["Construction"],
    impact: "High",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["risk", "customer"],
  },

  // ---------------------------
  // TRANSPORTATION
  // ---------------------------
  {
    id: "trans-route-optim",
    pillar: "E",
    title: "Route optimization + load factor KPI",
    text: "Reduce emissions through route planning and load optimization; track load factor by route monthly.",
    tags: ["logistics", "transport", "emissions", "metrics"],
    sectors: ["Transportation"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["cost", "decarbonization"],
    sizes: ["small", "medium", "large"],
  },
  {
    id: "trans-idling-policy",
    pillar: "E",
    title: "Idling reduction policy + driver coaching",
    text: "Set idling rules, coach drivers, and track fuel efficiency monthly; start with your top 10 routes.",
    tags: ["transport", "energy", "metrics"],
    sectors: ["Transportation"],
    impact: "Medium",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["cost", "decarbonization"],
  },

  // ---------------------------
  // FURNITURE (WITH FSC/PEFC)
  // ---------------------------
  {
    id: "fur-fsc-pefc-coc",
    pillar: "G",
    title: "Adopt FSC/PEFC Chain of Custody for wood products",
    text: "Implement FSC or PEFC Chain of Custody to verify certified material through your supply chain and satisfy customer requests.",
    tags: ["procurement", "traceability", "certification", "wood", "fsc", "pefc"],
    sectors: ["Furniture"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["customer", "compliance", "risk"],
    sizes: ["small", "medium", "large"],
  },
  {
    id: "fur-eudr-readiness",
    pillar: "G",
    title: "Timber legality & deforestation risk screening (EUDR-ready)",
    text: "Collect country/region of harvest, supplier declarations, and basic legality/deforestation risk checks for wood-based inputs.",
    tags: ["procurement", "traceability", "wood", "deforestation", "risk", "compliance"],
    sectors: ["Furniture"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "compliance", "customer"],
    sizes: ["small", "medium", "large"],
  },
  {
    id: "fur-bom-top-products",
    pillar: "E",
    title: "Create a Bill of Materials for top-selling products",
    text: "Document wood types, coatings, adhesives, and packaging for top products to enable waste reduction and future LCA/EPD readiness.",
    tags: ["materials", "bom", "lca", "epd", "chemicals"],
    sectors: ["Furniture"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["customer", "risk", "finance"],
  },
  {
    id: "fur-low-voc-finishes",
    pillar: "E",
    title: "Shift to low-VOC coatings and safer adhesives",
    text: "Identify highest-VOC coatings/adhesives and replace with safer alternatives; document SDS and worker handling basics.",
    tags: ["chemicals", "voc", "worker-safety", "materials"],
    sectors: ["Furniture"],
    impact: "High",
    effort: "Medium",
    timeframe: "6–12 months",
    goals: ["risk", "customer"],
  },
  {
    id: "fur-packaging-reduction",
    pillar: "E",
    title: "Reduce protective packaging and improve recyclability",
    text: "Review packaging for top shipments: reduce plastic, switch to recyclable protection materials, and standardize specs.",
    tags: ["packaging", "waste", "circularity", "recycling"],
    sectors: ["Furniture"],
    impact: "Medium",
    effort: "Low",
    timeframe: "0–6 months",
    goals: ["cost", "customer"],
    sizes: ["micro", "small", "medium", "large"],
  },
];

// --- optional compatibility helpers (keep if other code uses them) ---
export function filterSuggestions({ sector }) {
  if (!sector) return SUGGESTIONS;

  const normalize = (v) => {
    if (!v) return "";
    let s = String(v);
    try {
      s = decodeURIComponent(s);
    } catch {}
    return s.trim();
  };

  const sec = normalize(sector);
  return SUGGESTIONS.filter((s) => {
    const secs = (s.sectors || []).map(normalize);
    return secs.includes("*") || secs.includes("All") || secs.includes(sec);
  });
}

export function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

