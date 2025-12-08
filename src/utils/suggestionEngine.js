// src/utils/suggestionEngine.js
import { filterSuggestions } from "./suggestions";

// mapping molto semplice tag->pilastro (per booster)
const TAG_PILLAR = {
  energy: "E",
  "energy-efficiency": "E",
  lighting: "E",
  metering: "E",
  scope2: "E",
  water: "E",
  waste: "E",
  circularity: "E",
  logistics: "E", // scope3 logistico -> E per semplicità
  people: "S",
  "health-safety": "S",
  training: "S",
  "human-rights": "S",
  governance: "G",
  policy: "G",
  ethics: "G",
  procurement: "G",
  transparency: "G",
  foundations: "G",
};

function normalizeTags(arr) {
  return (arr || []).map((t) => String(t || "").toLowerCase().trim()).filter(Boolean);
}

// Ricostruisce gli stessi qid usati nel Questionnaire:
// qid = q.id || `${sector}:${pillarFull}:${indexWithinPillar}`
function normalizeQuestionsWithQid(questions, sector) {
  const buckets = { Environmental: [], Social: [], Governance: [] };
  (questions || []).forEach((q) => {
    const pillarFull =
      q.category ||
      (q.pillar === "E" ? "Environmental" : q.pillar === "S" ? "Social" : q.pillar === "G" ? "Governance" : null);
    if (!pillarFull || !buckets[pillarFull]) return;
    buckets[pillarFull].push(q);
  });

  const out = [];
  Object.entries(buckets).forEach(([pillarFull, list]) => {
    list.forEach((q, i) => {
      const qid = q.id || `${sector}:${pillarFull}:${i}`;
      out.push({
        ...q,
        qid,
        pillar: q.pillar || (pillarFull === "Environmental" ? "E" : pillarFull === "Social" ? "S" : "G"),
        tags: normalizeTags(q.tags),
        critical: !!q.critical,
      });
    });
  });
  return out;
}

// 1) Costruisci profilo dei NO (e UNKNOWN) per tag e pilastro
export function buildDeficitProfile({ questions, answers, sector }) {
  const qz = normalizeQuestionsWithQid(questions, sector);
  const tagScore = new Map(); // tag -> peso accumulato
  const pillarScore = { E: 0, S: 0, G: 0 };
  let totalNo = 0;

  qz.forEach((q) => {
    const a = answers?.[q.qid];
    if (a !== "No" && a !== "Unknown" && a !== "NA") return;
    const w = q.critical ? 2 : 1; // le critiche pesano doppio
    totalNo += w;

    const tags = q.tags?.length ? q.tags : [ (q.pillar === "E" ? "energy" : q.pillar === "S" ? "people" : "governance") ];
    tags.forEach((t) => tagScore.set(t, (tagScore.get(t) || 0) + w));

    pillarScore[q.pillar] += w;
  });

  return { tagScore, pillarScore, totalNo };
}

// 2) Ordina suggerimenti in base a: overlap tag + booster pilastro
export function getTailoredSuggestions({ sector, questions, answers, limit = 10 }) {
  const pool = filterSuggestions({ sector }); // già filtra per settore
  const { tagScore, pillarScore } = buildDeficitProfile({ questions, answers, sector });

  const scored = pool.map((sug) => {
    const tags = normalizeTags(sug.tags);
    // score base: somma dei pesi dei tag che matchano
    let score = tags.reduce((acc, t) => acc + (tagScore.get(t) || 0), 0);

    // booster di pilastro: se i tag del suggerimento mappano a un pilastro debole, aggiungi punti
    const pillarsInSug = new Set(tags.map((t) => TAG_PILLAR[t]).filter(Boolean));
    pillarsInSug.forEach((p) => (score += (pillarScore[p] || 0) * 0.5));

    // leggera priorità governance foundation se non c'è nulla di forte
    if (score === 0 && tags.includes("foundations")) score = 0.25;

    return { ...sug, _score: score };
  });

  // ordina per score desc, poi id per stabilità, poi porta su i "critical" se servisse (qui non abbiamo critical su sug)
  scored.sort((a, b) => b._score - a._score || a.id.localeCompare(b.id));

  // se nessun match, restituisci i primi N del pool come fallback
  const anyScore = scored.some((s) => s._score > 0);
  const finalList = (anyScore ? scored : pool).slice(0, limit);

  return finalList;
}
