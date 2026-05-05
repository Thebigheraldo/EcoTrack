import { getMaturityKey, getSuggestionForAnswer } from "./questions";

/* ---------- helpers ---------- */
function clampScore(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (n < 0) return 0;
  if (n > 4) return 4;
  return n;
}

function safeString(v) {
  return v == null ? "" : String(v).trim();
}

function normalizePillar(v) {
  const s = safeString(v).toLowerCase();
  if (s === "e" || s === "environmental") return "E";
  if (s === "s" || s === "social") return "S";
  if (s === "g" || s === "governance") return "G";
  return null;
}

function scoreToLabel(score) {
  if (score === 0) return "Not in place";
  if (score === 1) return "Informal / ad hoc";
  if (score === 2) return "Partially structured";
  if (score === 3) return "Implemented & documented";
  if (score === 4) return "Advanced / best practice";
  return "Not answered";
}

function getAnswerScore(value) {
  if (value == null) return null;

  if (typeof value === "number") {
    return clampScore(value);
  }

  if (typeof value === "object") {
    if (typeof value.score === "number") return clampScore(value.score);
    if (typeof value.value === "number") return clampScore(value.value);
    if (typeof value.points === "number") return clampScore(value.points);
    if (typeof value.answerScore === "number") return clampScore(value.answerScore);
    if (typeof value.numericScore === "number") return clampScore(value.numericScore);

    const label =
      value.label ||
      value.answerLabel ||
      value.answer ||
      value.valueLabel ||
      "";

    const m = getMaturityKey(label);
    if (m === "notInPlace") return 0;
    if (m === "informal") return 1;
    if (m === "partial") return 2;
    if (m === "implemented") return 3;
    if (m === "advanced") return 4;

    const raw = safeString(label).toLowerCase();
    if (raw === "yes") return 4;
    if (raw === "no") return 0;
    if (raw === "partial") return 2;
    if (raw === "unknown" || raw === "n/a" || raw === "na") return 0;

    return null;
  }

  const s = safeString(value).toLowerCase();
  if (!s) return null;

  const m = getMaturityKey(value);
  if (m === "notInPlace") return 0;
  if (m === "informal") return 1;
  if (m === "partial") return 2;
  if (m === "implemented") return 3;
  if (m === "advanced") return 4;

  if (s === "yes") return 4;
  if (s === "no") return 0;
  if (s === "partial") return 2;
  if (s === "unknown" || s === "n/a" || s === "na") return 0;

  const n = Number(s);
  return Number.isNaN(n) ? null : clampScore(n);
}

function getAnswerLabel(value) {
  if (value == null) return "Not answered";

  if (typeof value === "object") {
    if (value.label) return String(value.label);
    if (value.answerLabel) return String(value.answerLabel);
    if (typeof value.score === "number") return scoreToLabel(clampScore(value.score));
    if (typeof value.answerScore === "number") return scoreToLabel(clampScore(value.answerScore));
    if (typeof value.numericScore === "number") return scoreToLabel(clampScore(value.numericScore));
  }

  if (typeof value === "number") {
    return scoreToLabel(clampScore(value));
  }

  const s = safeString(value);
  if (!s) return "Not answered";
  return s;
}

function getMaturityFromAnswer(value) {
  const label = getAnswerLabel(value);
  const byLabel = getMaturityKey(label);
  if (byLabel) return byLabel;

  const score = getAnswerScore(value);
  if (score == null) return null;
  if (score === 0) return "notInPlace";
  if (score === 1) return "informal";
  if (score === 2) return "partial";
  if (score === 3) return "implemented";
  if (score === 4) return "advanced";
  return null;
}

function normalizeAnswersInput(questions = [], answers = {}) {
  if (!answers) return {};

  if (!Array.isArray(answers) && typeof answers === "object") {
    return answers;
  }

  if (Array.isArray(answers)) {
    const out = {};
    questions.forEach((q, idx) => {
      out[q.id] = answers[idx];
    });
    return out;
  }

  return {};
}

function inferPillarAverages({ questions = [], answers = {} }) {
  const answersMap = normalizeAnswersInput(questions, answers);

  const sums = { E: 0, S: 0, G: 0 };
  const weights = { E: 0, S: 0, G: 0 };

  for (const q of questions || []) {
    const p = normalizePillar(q.pillar || q.esg || q.category);
    if (!p) continue;

    const score = getAnswerScore(answersMap[q.id]);
    if (typeof score !== "number") continue;

    const w = Number.isFinite(q.weight) ? q.weight : 1;
    sums[p] += score * w;
    weights[p] += w;
  }

  return {
    E: weights.E ? sums.E / weights.E : null,
    S: weights.S ? sums.S / weights.S : null,
    G: weights.G ? sums.G / weights.G : null,
  };
}

export function inferWorstPillar({ questions = [], answers = {} }) {
  const avgs = inferPillarAverages({ questions, answers });
  const entries = Object.entries(avgs).filter(([, v]) => typeof v === "number");
  if (!entries.length) return null;
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

function toPct(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  if (v >= 0 && v <= 1) return Math.round(v * 100);
  return Math.round(v);
}

function normalizePillarPercents(pillarPercents) {
  if (!pillarPercents || typeof pillarPercents !== "object") return null;

  const out = {
    E: toPct(
      pillarPercents.E ??
        pillarPercents.env ??
        pillarPercents.environmental ??
        null
    ),
    S: toPct(
      pillarPercents.S ??
        pillarPercents.soc ??
        pillarPercents.social ??
        null
    ),
    G: toPct(
      pillarPercents.G ??
        pillarPercents.gov ??
        pillarPercents.governance ??
        null
    ),
  };

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
  return entries.slice(0, Math.max(1, n)).map(([pillar]) => pillar);
}

function lowestNPillarsByAnswers({ questions = [], answers = {}, n = 2 }) {
  const avgs = inferPillarAverages({ questions, answers });
  const entries = Object.entries(avgs).filter(([, v]) => typeof v === "number");
  if (!entries.length) return [];

  entries.sort((a, b) => a[1] - b[1]);
  return entries.slice(0, Math.max(1, n)).map(([pillar]) => pillar);
}

function cleanQuestionTitle(questionText = "") {
  return String(questionText)
    .replace(/\?+$/, "")
    .replace(/^do you\s+/i, "")
    .replace(/^have you\s+/i, "")
    .replace(/^how do you\s+/i, "")
    .replace(/^is there\s+/i, "")
    .replace(/^are you\s+/i, "")
    .replace(/^are your\s+/i, "")
    .replace(/^do your\s+/i, "")
    .replace(/^can you\s+/i, "")
    .trim();
}

function capitalizeFirst(text = "") {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function titlePrefixForMaturity(maturity) {
  if (maturity === "notInPlace") return "Start building";
  if (maturity === "informal") return "Formalize";
  if (maturity === "partial") return "Strengthen";
  if (maturity === "implemented") return "Optimize";
  return "Improve";
}

function impactForQuestion(q) {
  if (q?.critical) return "High";
  if ((q?.weight || 1) >= 3) return "High";
  return "Medium";
}

function effortForMaturity(maturity) {
  if (maturity === "notInPlace") return "Medium";
  if (maturity === "informal") return "Medium";
  if (maturity === "partial") return "Medium";
  if (maturity === "implemented") return "High";
  return "Medium";
}

function timeframeForMaturity(maturity) {
  if (maturity === "notInPlace") return "0–6 months";
  if (maturity === "informal") return "0–6 months";
  if (maturity === "partial") return "6–12 months";
  if (maturity === "implemented") return "12+ months";
  return "6–12 months";
}

function priorityForMaturity(maturity) {
  if (maturity === "notInPlace") return 100;
  if (maturity === "informal") return 80;
  if (maturity === "partial") return 60;
  if (maturity === "implemented") return 40;
  return -999;
}

function maturitySortOrder(maturity) {
  if (maturity === "notInPlace") return 1;
  if (maturity === "informal") return 2;
  if (maturity === "partial") return 3;
  if (maturity === "implemented") return 4;
  if (maturity === "advanced") return 5;
  return 99;
}

function buildQuestionSuggestion({
  question,
  rawAnswer,
  selectedPillars = [],
  worstPillar = null,
}) {
  if (!question?.id) return null;

  const maturity = getMaturityFromAnswer(rawAnswer);
  if (!maturity || maturity === "advanced") return null;

  const suggestionText =
    question?.guidance?.[maturity] || getSuggestionForAnswer(question, rawAnswer);

  if (!suggestionText) return null;

  const pillar = normalizePillar(question.pillar || question.category || question.esg);
  const titleBase = cleanQuestionTitle(question.question || question.text || "");
  const title = `${titlePrefixForMaturity(maturity)}: ${capitalizeFirst(titleBase)}`;

  let rank = priorityForMaturity(maturity);

  if (pillar && selectedPillars.includes(pillar)) rank += 25;
  if (pillar && worstPillar && pillar === worstPillar) rank += 10;
  if (question.critical) rank += 8;
  if (Number.isFinite(question.weight)) rank += question.weight * 4;

  return {
    id: `${question.id}-${maturity}`,
    source: "question",
    questionId: question.id,
    questionText: question.question || question.text || "",
    answerLabel: getAnswerLabel(rawAnswer),
    pillar,
    title,
    text: suggestionText,
    tags: Array.isArray(question.tags) ? question.tags : [],
    impact: impactForQuestion(question),
    effort: effortForMaturity(maturity),
    timeframe: timeframeForMaturity(maturity),
    _rank: rank,
    _maturityOrder: maturitySortOrder(maturity),
  };
}

/**
 * Question-based tailored suggestions.
 */
export function getTailoredSuggestions({
  sector,
  questions = [],
  answers = {},
  profile = {},
  limit = 20,
  pillarPercents = null,
  pillarThreshold = 50,
  fallbackLowestNPillars = 2,
}) {
  const normalizedQuestions = Array.isArray(questions) ? questions : [];
  if (!normalizedQuestions.length) return [];

  const answersMap = normalizeAnswersInput(normalizedQuestions, answers);

  let selectedPillars = pillarsBelowThreshold(pillarPercents, pillarThreshold);

  if (!selectedPillars.length) {
    selectedPillars = lowestNPillarsByPercents(
      pillarPercents,
      fallbackLowestNPillars
    );
  }

  if (!selectedPillars.length) {
    selectedPillars = lowestNPillarsByAnswers({
      questions: normalizedQuestions,
      answers: answersMap,
      n: fallbackLowestNPillars,
    });
  }

  const worstPillar = inferWorstPillar({
    questions: normalizedQuestions,
    answers: answersMap,
  });

  const ranked = normalizedQuestions
    .map((question) =>
      buildQuestionSuggestion({
        question,
        rawAnswer: answersMap[question.id],
        selectedPillars,
        worstPillar,
      })
    )
    .filter(Boolean)
    .sort((a, b) => {
      if (b._rank !== a._rank) return b._rank - a._rank;
      if (a._maturityOrder !== b._maturityOrder) {
        return a._maturityOrder - b._maturityOrder;
      }
      return String(a.title).localeCompare(String(b.title));
    });

  return ranked
    .slice(0, Math.max(1, limit))
    .map(({ _rank, _maturityOrder, ...rest }) => rest);
}

