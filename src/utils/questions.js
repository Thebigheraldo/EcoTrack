// src/utils/questions.js

// =====================
// HELPERS
// =====================

// Base compatto: puoi passare opzionalmente tags, critical, weight
const base = (category, question, tags = [], critical = false, weight = undefined) => ({
  category,
  question,
  tags,        // array di tag (minuscoli, es. ["energy", "metering"])
  critical,    // se la domanda è particolarmente rilevante
  weight,      // opzionale: numero (es. 1, 2, 3). Se assente, inferenza automatica.
});

// Alias per uniformare i nomi tra onboarding e dataset
const sectorAlias = {
  "Agriculture/Food": "AgricultureFood",
  "Textile/Fashion": "TextileFashion",
  // gli altri sono già coerenti: Manufacturing, Tech, Finance, Construction, Furniture, Transportation
};

// Mappa categoria → codice pilastro
const pillarMap = {
  Environmental: "E",
  Social: "S",
  Governance: "G",
};

// Inference: se non metti tags nella domanda, li deduciamo dal testo
const KEYWORD_TAGS = [
  { re: /renewable|ppa|green tariff/i, tags: ["energy", "scope2"] },
  { re: /energy\s*(efficien|saving)|\bled\b|lighting/i, tags: ["energy-efficiency", "lighting"] },
  { re: /sub-?meter|metering|submeter/i, tags: ["metering", "energy"] },
  { re: /\b(kpi|track|tracking|measure|monitor|target|goal|report|disclos)/i, tags: ["metrics", "transparency"] },
  { re: /water|wastewater/i, tags: ["water"] },
  { re: /waste|recycl|circular/i, tags: ["waste", "circularity"] },
  { re: /logistics|transport|delivery|route/i, tags: ["logistics"] },
  { re: /hazardous|chemical/i, tags: ["chemicals"] },
  { re: /supply\s*chain|supplier/i, tags: ["procurement", "human-rights"] },
  { re: /health|safety/i, tags: ["health-safety", "training"] },
  { re: /diversity|inclusion|wage|fair/i, tags: ["people"] },
  { re: /training|train\b/i, tags: ["training"] },
  { re: /community|communities/i, tags: ["people"] },
  { re: /code of ethics|ethics|anti-?corruption|bribery/i, tags: ["ethics", "policy"] },
  { re: /\bpolicy|policies\b/i, tags: ["policy", "governance"] },
  { re: /board|governance|oversight/i, tags: ["governance", "foundations"] },
  { re: /biodivers/i, tags: ["biodiversity"] },
  { re: /portfolio|investment|finance\b/i, tags: ["governance", "transparency"] },
];

function normalizeTags(arr) {
  return [...new Set((arr || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean))];
}

function inferTagsFromText(question, category) {
  const out = new Set();
  for (const { re, tags } of KEYWORD_TAGS) {
    if (re.test(question)) tags.forEach((t) => out.add(t));
  }
  // Fallback minimo per pilastro se non è emerso nulla
  if (!out.size) {
    if (category === "Environmental") out.add("energy");
    else if (category === "Social") out.add("people");
    else if (category === "Governance") out.add("governance");
  }
  return [...out];
}

// ===============
// PESI INFERITI
// ===============
// Regole semplici e trasparenti per stimare un peso relativo all'interno del pilastro.
// Scala consigliata: 1 (basso) • 2 (medio) • 3 (alto). I "critical" partono da 3.
// Puoi raffinare le regole o assegnare pesi espliciti nei dati (5° argomento di base()).

function inferWeight({ pillar, tags, critical }) {
  if (critical) return 3;

  const t = new Set(tags || []);

  // Environmental
  if (pillar === "E") {
    if (hasAny(t, ["metrics", "scope2", "energy", "energy-efficiency"])) return 3; // clima/energia
    if (hasAny(t, ["water", "waste", "circularity", "chemicals", "biodiversity"])) return 2;
    return 1;
  }

  // Social
  if (pillar === "S") {
    if (hasAny(t, ["health-safety", "human-rights"])) return 3; // H&S / diritti umani
    if (hasAny(t, ["people", "training"])) return 2;
    return 1;
  }

  // Governance
  if (pillar === "G") {
    if (hasAny(t, ["ethics", "policy", "governance", "foundations"])) return 3; // etica/oversight
    if (hasAny(t, ["transparency", "procurement", "metrics"])) return 2;
    return 1;
  }

  // fallback
  return 1;
}

function hasAny(tagSet, arr) {
  for (const a of arr) if (tagSet.has(a)) return true;
  return false;
}

// =====================
// DATASET DOMANDE (con alcuni tag espliciti nei punti chiave)
// =====================

const data = {
  Manufacturing: [
    base("Environmental", "Do you track and report your carbon footprint?", ["metrics", "transparency", "energy"]),
    base("Environmental", "Have you set emission reduction targets in line with global climate goals?", ["metrics", "policy", "energy"], true),
    base("Environmental", "Do you use renewable energy sources in your operations?", ["energy", "scope2"], true),
    base("Environmental", "Have you implemented an energy efficiency program?", ["energy-efficiency"]),
    base("Environmental", "Do you track and optimize water usage in your production?", ["water", "metrics"]),
    base("Environmental", "How do you manage waste and recycling in your operations?", ["waste", "circularity"]),
    base("Environmental", "Do you follow circular economy principles?", ["circularity"]),
    base("Environmental", "Do you reduce hazardous materials in production?", ["chemicals"]),
    base("Environmental", "Have you assessed your supply chain for environmental risks?", ["procurement", "governance"]),
    base("Environmental", "Do your suppliers meet environmental certifications?", ["procurement", "governance"]),
    base("Social", "Do you have policies ensuring fair wages and working conditions?", ["people", "human-rights", "policy"], true),
    base("Social", "Do you ensure health & safety compliance for employees?", ["health-safety", "training"], true),
    base("Social", "Do you promote diversity and inclusion in hiring?", ["people"]),
    base("Social", "Do you assess the social impact of your supply chain?", ["human-rights", "procurement"]),
    base("Social", "Do you train employees on sustainability?", ["training"]),
    base("Social", "Do you support local communities?", ["people"]),
    base("Governance", "Do you have a code of ethics for employees and suppliers?", ["ethics", "policy"], true),
    base("Governance", "Do you have a compliance program for anti-corruption?", ["ethics", "policy"]),
    base("Governance", "Do you integrate ESG risks into business strategy?", ["governance", "foundations"], true),
    base("Governance", "Is there an ESG responsible person in the company?", ["governance", "foundations"]),
  ],

  AgricultureFood: [
    base("Environmental", "Do you track greenhouse gas emissions from farming?"),
    base("Environmental", "Do you use sustainable farming practices?"),
    base("Environmental", "Have you implemented water conservation measures?", ["water"]),
    base("Environmental", "Do you reduce soil degradation and deforestation?"),
    base("Environmental", "Do you use biodegradable or recyclable packaging?", ["waste", "circularity"]),
    base("Environmental", "Do you reduce food waste in production?", ["waste", "circularity"]),
    base("Environmental", "Do you ensure sustainable sourcing of raw materials?", ["procurement"]),
    base("Environmental", "Do you limit use of synthetic pesticides?", ["chemicals"]),
    base("Environmental", "Do you measure impact on biodiversity?", ["biodiversity"]),
    base("Environmental", "Do you participate in carbon offsetting or reforestation?"),
    base("Social", "Do you have fair labor policies for farm workers?", ["people", "human-rights", "policy"]),
    base("Social", "Do you provide safe working conditions?", ["health-safety", "training"]),
    base("Social", "Do you audit human rights in the supply chain?", ["human-rights", "procurement"]),
    base("Social", "Are smallholder farmers included in sustainability programs?", ["people"]),
    base("Social", "Do you ensure fair wages across your supply chain?", ["people", "human-rights"]),
    base("Social", "Do you have a policy against child and forced labor?", ["human-rights", "policy"], true),
    base("Governance", "Do you hold certifications like Fair Trade or Organic?", ["transparency", "procurement"]),
    base("Governance", "Do you perform ESG due diligence on suppliers?", ["governance", "procurement"]),
    base("Governance", "Do you comply with EU food safety and ESG laws?", ["governance"]),
    base("Governance", "Do you report sustainability data to stakeholders?", ["transparency"]),
  ],

  TextileFashion: [
    base("Environmental", "Do you track and reduce CO₂ emissions in production?", ["metrics", "energy"]),
    base("Environmental", "Do you use sustainable materials like organic cotton?", ["procurement", "circularity"]),
    base("Environmental", "Do you implement water-saving techniques in dyeing?", ["water"]),
    base("Environmental", "Do you manage chemicals responsibly in production?", ["chemicals"]),
    base("Environmental", "Do you follow circular fashion principles?", ["circularity"]),
    base("Environmental", "Do your suppliers meet environmental certifications?", ["procurement", "governance"]),
    base("Environmental", "Do you track supply chain carbon emissions?", ["metrics", "procurement"]),
    base("Environmental", "Do you have targets for reducing textile waste?", ["waste", "circularity", "metrics"]),
    base("Social", "Do you ensure safe working conditions in factories?", ["health-safety"]),
    base("Social", "Do you prohibit forced and child labor?", ["human-rights", "policy"], true),
    base("Social", "Do you pay fair wages to garment workers?", ["people", "human-rights"]),
    base("Social", "Are your products ethically sourced and produced?", ["procurement", "ethics"]),
    base("Social", "Do you improve worker well-being?", ["people"]),
    base("Social", "Do you conduct third-party audits on labor conditions?", ["human-rights", "procurement"]),
    base("Social", "Do you promote diversity in leadership?", ["people"]),
    base("Governance", "Do you ensure supply chain transparency?", ["transparency", "procurement"]),
    base("Governance", "Do you report ESG performance indicators?", ["transparency", "metrics"]),
    base("Governance", "Do you follow a business code of ethics?", ["ethics", "policy"]),
    base("Governance", "Do you integrate ESG risks in strategic decisions?", ["governance", "foundations"]),
    base("Governance", "Do you educate employees and suppliers on sustainability?", ["training", "governance"]),
  ],

  Tech: [
    base("Environmental", "Do you track and reduce energy consumption in data centers?", ["energy", "metrics"], true),
    base("Environmental", "Do you use renewable energy for operations?", ["energy", "scope2"]),
    base("Environmental", "Do you set targets for reducing electronic waste?", ["waste", "metrics"]),
    base("Environmental", "Do you run take-back or recycling programs?", ["waste", "circularity"]),
    base("Environmental", "Do you ensure responsible sourcing of materials?", ["procurement"]),
    base("Environmental", "Do you track carbon emissions from your supply chain?", ["metrics", "procurement"]),
    base("Environmental", "Do you design energy-efficient products?", ["energy-efficiency"]),
    base("Environmental", "Do you ensure low water consumption in production?", ["water"]),
    base("Social", "Do you protect labor rights in supply chains?", ["human-rights", "procurement"]),
    base("Social", "Do you ethically source rare minerals?", ["procurement", "human-rights"]),
    base("Social", "Do you have cybersecurity policies to protect user data?", ["policy"]),
    base("Social", "Do you promote digital inclusion?", ["people"]),
    base("Social", "Do you ensure safe conditions in manufacturing?", ["health-safety"]),
    base("Social", "Do you promote gender diversity in leadership?", ["people"]),
    base("Governance", "Do you disclose ESG and data privacy policies?", ["transparency", "policy"]),
    base("Governance", "Do you prevent misinformation and AI bias?", ["governance"]),
    base("Governance", "Is there board oversight on ESG topics?", ["governance", "foundations"]),
    base("Governance", "Do you integrate ESG into product development?", ["governance"]),
    base("Governance", "Do you follow anti-bribery policies?", ["ethics", "policy"]),
    base("Governance", "Do you report ESG impacts to stakeholders?", ["transparency"]),
  ],

  Finance: [
    base("Environmental", "Do you integrate climate risk into investment decisions?", ["governance", "metrics"]),
    base("Environmental", "Do you finance green or sustainable projects?", ["transparency"]),
    base("Environmental", "Do you track the carbon footprint of investment portfolios?", ["metrics", "transparency"]),
    base("Environmental", "Have you set decarbonization targets for financed emissions?", ["metrics", "policy"]),
    base("Environmental", "Do you offer green financial products?", ["transparency"]),
    base("Environmental", "Do you disclose ESG risks related to climate impact?", ["transparency", "governance"]),
    base("Social", "Do you have equal employment policies?", ["people", "policy"]),
    base("Social", "Do you include diversity in company policies?", ["people", "policy"]),
    base("Social", "Do you support financial inclusion programs?", ["people"]),
    base("Social", "Do you ensure fair lending practices?", ["people"]),
    base("Social", "Do you conduct human rights due diligence for financed companies?", ["human-rights"]),
    base("Social", "Do you assess social impact in investments?", ["metrics"]),
    base("Social", "Do you have fair compensation policies?", ["people"]),
    base("Governance", "Do you have an ESG risk management framework?", ["governance"]),
    base("Governance", "Do you disclose ESG investment performance?", ["transparency"]),
    base("Governance", "Do you integrate ESG in corporate governance?", ["governance"]),
    base("Governance", "Do you enforce anti-corruption policies in finance operations?", ["ethics", "policy"]),
    base("Governance", "Do you conduct third-party ESG assessments?", ["governance"]),
    base("Governance", "Do you align investment strategy with EU taxonomy?", ["governance", "policy"]),
    base("Governance", "Do you have an ESG officer?", ["governance", "foundations"]),
  ],

  Construction: [
    base("Environmental", "Do you track carbon emissions from construction activities?", ["metrics", "energy"]),
    base("Environmental", "Do you use low-carbon or recycled materials?", ["circularity", "procurement"]),
    base("Environmental", "Have you implemented energy-saving strategies on-site?", ["energy-efficiency"]),
    base("Environmental", "Do you have a water conservation program in construction?", ["water"]),
    base("Environmental", "Do you recycle construction debris and manage waste?", ["waste", "circularity"]),
    base("Environmental", "Do you follow green building certifications (LEED, BREEAM)?", ["transparency"]),
    base("Environmental", "Do you use renewable energy in operations?", ["energy", "scope2"]),
    base("Environmental", "Do you protect biodiversity during construction?", ["biodiversity"]),
    base("Environmental", "Have you assessed climate resilience in your projects?", ["governance"]),
    base("Environmental", "Do you apply circular economy in building design?", ["circularity"]),
    base("Social", "Do you enforce strict safety and health rules for workers?", ["health-safety", "training"], true),
    base("Social", "Do you ensure fair wages for employees and subcontractors?", ["people"]),
    base("Social", "Do you engage local communities during construction?", ["people"]),
    base("Social", "Do you promote diversity in the workforce?", ["people"]),
    base("Social", "Do you offer training on sustainable building practices?", ["training"]),
    base("Governance", "Do you have an anti-corruption policy in procurement?", ["ethics", "policy"]),
    base("Governance", "Do you monitor ESG compliance of suppliers and subcontractors?", ["governance", "procurement"]),
    base("Governance", "Do you perform third-party ESG audits?", ["governance"]),
    base("Governance", "Do you disclose ESG performance in reports?", ["transparency"]),
    base("Governance", "Is there a dedicated ESG officer?", ["governance", "foundations"]),
  ],

  Furniture: [
    base("Environmental", "Do you use FSC/PEFC certified sustainable wood?", ["procurement", "transparency"]),
    base("Environmental", "Do you have a policy to reduce deforestation risks?", ["policy", "procurement"]),
    base("Environmental", "Do you use recycled materials in production?", ["circularity"]),
    base("Environmental", "Do you track and reduce carbon emissions from production and logistics?", ["metrics", "logistics"]),
    base("Environmental", "Do you follow eco-friendly finishing and chemical safety?", ["chemicals"]),
    base("Environmental", "Do you have a take-back/recycling program for furniture?", ["circularity", "waste"]),
    base("Environmental", "Have you assessed water usage and pollution in manufacturing?", ["water"]),
    base("Environmental", "Do you follow circular economy strategies?", ["circularity"]),
    base("Social", "Do you ensure fair labor conditions in your factories?", ["human-rights", "people"]),
    base("Social", "Do your suppliers follow ethical sourcing standards?", ["procurement", "human-rights"]),
    base("Social", "Do you perform safety audits for workers?", ["health-safety"]),
    base("Social", "Do you offer training and development programs?", ["training"]),
    base("Social", "Do you work with local communities on sustainable wood sourcing?", ["people"]),
    base("Social", "Do you promote gender diversity in leadership?", ["people"]),
    base("Governance", "Do you disclose supply chain transparency in ESG reports?", ["transparency", "procurement"]),
    base("Governance", "Do you have an ESG risk management strategy?", ["governance"]),
    base("Governance", "Do you audit suppliers on ESG due diligence?", ["governance", "procurement"]),
    base("Governance", "Do you ensure responsible marketing (avoid greenwashing)?", ["ethics", "transparency"]),
    base("Governance", "Do you integrate ESG into business strategy?", ["governance"]),
    base("Governance", "Do you report ESG results to stakeholders?", ["transparency"]),
  ],

  Transportation: [
    base("Environmental", "Do you track and reduce CO₂ emissions from logistics and transport?", ["metrics", "logistics"], true),
    base("Environmental", "Do you use electric or low-emission vehicles in your fleet?", ["logistics"]),
    base("Environmental", "Have you optimized delivery routes to save fuel?", ["logistics", "energy-efficiency"]),
    base("Environmental", "Do you use alternative fuels (biofuels, hydrogen)?"),
    base("Environmental", "Do you reduce air pollution from logistics operations?", ["logistics"]),
    base("Environmental", "Do you run carbon offset programs?"),
    base("Environmental", "Do you offer eco-driving training for drivers?", ["training", "logistics"]),
    base("Environmental", "Do you manage waste in transport hubs responsibly?", ["waste"]),
    base("Social", "Do you ensure safe and fair working conditions for drivers?", ["people", "health-safety"]),
    base("Social", "Do you have fatigue management systems for long-distance drivers?", ["health-safety"]),
    base("Social", "Do you have inclusion and diversity policies?", ["people", "policy"]),
    base("Social", "Do you train employees on ESG topics?", ["training"]),
    base("Social", "Do you monitor subcontractor labor practices?", ["human-rights", "procurement"]),
    base("Social", "Do you engage local communities impacted by transport?", ["people"]),
    base("Governance", "Do you have ESG screening for suppliers?", ["governance", "procurement"]),
    base("Governance", "Do you track and report ESG KPIs?", ["metrics", "transparency"]),
    base("Governance", "Do you comply with EU emissions regulations?", ["governance", "policy"]),
    base("Governance", "Do you integrate ESG into transport planning?", ["governance"]),
    base("Governance", "Do you have anti-bribery rules in procurement?", ["ethics", "policy"]),
    base("Governance", "Do you disclose fuel efficiency and emissions data?", ["transparency"]),
  ],
};

// =====================
// FUNZIONI DI ACCESSO
// =====================

// Dataset grezzo (retrocompatibilità)
export function getQuestionsBySector(sector) {
  const key = sectorAlias[sector] ?? sector;
  return (data || {})[key] || [];
}

// Domande arricchite per il Questionnaire/tab:
// [{ id, text, pillar: 'E'|'S'|'G', type: 'yesno', tags: [...], critical: bool, weight: number }]
export function getQuestionsForSector(sector) {
  const key = sectorAlias[sector] ?? sector;
  const raw = (data || {})[key] || [];

  return raw.map((q, idx) => {
    const tags = normalizeTags(q.tags?.length ? q.tags : inferTagsFromText(q.question, q.category));
    const pillar = pillarMap[q.category] ?? "E";
    // Se la domanda ha weight esplicito, usiamo quello; altrimenti inferiamo
    const weight = Number.isFinite(q.weight) ? q.weight : inferWeight({ pillar, tags, critical: !!q.critical });

    return {
      id: `${key}-${idx + 1}`,
      text: q.question,
      pillar,
      type: "yesno",
      tags,
      critical: !!q.critical,
      weight, // <= nuovo campo usato dallo scoring pro
    };
  });
}

export default data;


  