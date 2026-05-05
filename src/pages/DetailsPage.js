import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { useUserSettings } from "../hooks/useUserSettings";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getQuestionsForSector } from "../utils/questions";
import { getTailoredSuggestions } from "../utils/suggestionEngine";
import InfoTooltip from "../components/InfoTooltip";

/* ---------------- Benchmarks aligned to sector labels ---------------- */
const benchmarkData = {
  Manufacturing: { Environmental: 62, Social: 55, Governance: 60 },
  Finance: { Environmental: 48, Social: 61, Governance: 72 },
  "Agriculture/Food": { Environmental: 58, Social: 57, Governance: 50 },
  Tech: { Environmental: 54, Social: 68, Governance: 65 },
  Construction: { Environmental: 60, Social: 56, Governance: 52 },
  Transportation: { Environmental: 64, Social: 58, Governance: 51 },
  "Textile/Fashion": { Environmental: 59, Social: 60, Governance: 49 },
  Furniture: { Environmental: 61, Social: 59, Governance: 47 },
};

/* ---------------- Sector weights ---------------- */
const SECTOR_WEIGHTS = {
  Manufacturing: { Environmental: 0.5, Social: 0.3, Governance: 0.2 },
  Finance: { Environmental: 0.2, Social: 0.3, Governance: 0.5 },
  "Agriculture/Food": { Environmental: 0.4, Social: 0.4, Governance: 0.2 },
  Tech: { Environmental: 0.25, Social: 0.35, Governance: 0.4 },
  Construction: { Environmental: 0.45, Social: 0.35, Governance: 0.2 },
  Transportation: { Environmental: 0.5, Social: 0.3, Governance: 0.2 },
  "Textile/Fashion": { Environmental: 0.4, Social: 0.4, Governance: 0.2 },
  Furniture: { Environmental: 0.4, Social: 0.4, Governance: 0.2 },
};

const CRITICAL_PILLAR_THRESHOLD = 20;
const WEAK_PILLAR_THRESHOLD = 40;
const IMBALANCE_GAP_THRESHOLD = 35;

const DETAILS_TRANSLATIONS = {
  en: {
    title: "ESG Assessment Results",
    subtitle: "Overview of your latest ESG performance",
    overallScoreLabel: "Overall ESG score",
    envLabel: "Environmental",
    socLabel: "Social",
    govLabel: "Governance",
    benchmarkTitle: "Benchmarks",
    benchmarkSubtitleEU: "Compared with EU average",
    benchmarkSubtitleIT: "Compared with Italian average",
    benchmarkSubtitleGlobal: "Compared with global average",
    breakdownTitle: "Breakdown by Category",
    suggestionsTitle: "Suggested Improvements",
    industryAverageLabel: "Industry average",
    startOver: "Start Over",
    downloadPdf: "Download PDF",
    seeSuggestions: "See Suggestions",
    goDashboard: "Go to Dashboard",
    openCriticalReview: "Open Critical Review",
    criticalAlertTitle: "Critical ESG gap detected",
    close: "Close",
    whatThisMeansTitle: "What this means",
    whatThisMeansIntro:
      "Short interpretation of your score, benchmark position, and where to start.",
    resultLabel: "Result",
    appliedWeightsLabel: "Applied Weights",
    overallHiddenTitle: "Overall score not displayed",
    overallHiddenBody:
      "EcoTrack has detected one or more critical ESG gaps. The overall score is hidden because a weighted average could give a misleading view of ESG maturity.",
    criticalPillarsLabel: "Critical pillar(s)",
    criticalNextStep:
      "Review the critical pillar first, define corrective actions, and repeat the assessment after implementation.",
    criticalAlertBody:
      "One or more ESG pillars scored 20% or below. EcoTrack does not display the overall score in this case because a weighted average could hide a serious weakness.",
  },
  it: {
    title: "Risultati della valutazione ESG",
    subtitle: "Panoramica delle tue ultime performance ESG",
    overallScoreLabel: "Punteggio ESG complessivo",
    envLabel: "Ambientale",
    socLabel: "Sociale",
    govLabel: "Governance",
    benchmarkTitle: "Benchmark",
    benchmarkSubtitleEU: "Confronto con la media UE",
    benchmarkSubtitleIT: "Confronto con la media italiana",
    benchmarkSubtitleGlobal: "Confronto con la media globale",
    breakdownTitle: "Dettaglio per categoria",
    suggestionsTitle: "Suggerimenti di miglioramento",
    industryAverageLabel: "Media di settore",
    startOver: "Ricomincia",
    downloadPdf: "Scarica PDF",
    seeSuggestions: "Vedi suggerimenti",
    goDashboard: "Vai alla dashboard",
    openCriticalReview: "Apri analisi critica",
    criticalAlertTitle: "Gap ESG critico rilevato",
    close: "Chiudi",
    whatThisMeansTitle: "Cosa significa",
    whatThisMeansIntro:
      "Una breve interpretazione del tuo punteggio, della posizione rispetto al benchmark e da dove partire.",
    resultLabel: "Risultato",
    appliedWeightsLabel: "Pesi applicati",
    overallHiddenTitle: "Punteggio complessivo non mostrato",
    overallHiddenBody:
      "EcoTrack ha rilevato uno o più gap ESG critici. Il punteggio complessivo viene nascosto perché una media ponderata potrebbe dare una visione fuorviante della maturità ESG.",
    criticalPillarsLabel: "Pilastro/i critico/i",
    criticalNextStep:
      "Rivedi prima il pilastro critico, definisci azioni correttive e ripeti la valutazione dopo l’implementazione.",
    criticalAlertBody:
      "Uno o più pilastri ESG hanno ottenuto un punteggio pari o inferiore al 20%. In questo caso EcoTrack non mostra il punteggio complessivo perché una media ponderata potrebbe nascondere una debolezza seria.",
  },
};

/* ---------------- Critical score logic ---------------- */
function isValidNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function evaluateCriticalScore(pillarScores = {}) {
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
      imbalanceGap: null,
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

  const values = validEntries.map(([, score]) => score);
  const highestScore = Math.max(...values);
  const lowestScore = Math.min(...values);
  const imbalanceGap = highestScore - lowestScore;

  if (criticalPillars.length > 0) {
    return {
      level: "critical",
      hideOverallScore: true,
      criticalPillars,
      weakPillars,
      imbalanceGap,
    };
  }

  if (weakPillars.length > 0) {
    return {
      level: "weak",
      hideOverallScore: false,
      criticalPillars: [],
      weakPillars,
      imbalanceGap,
    };
  }

  if (imbalanceGap >= IMBALANCE_GAP_THRESHOLD) {
    return {
      level: "imbalanced",
      hideOverallScore: false,
      criticalPillars: [],
      weakPillars: [],
      imbalanceGap,
    };
  }

  return {
    level: "normal",
    hideOverallScore: false,
    criticalPillars: [],
    weakPillars: [],
    imbalanceGap,
  };
}

function fullPillarToCode(pillar) {
  if (pillar === "Environmental") return "E";
  if (pillar === "Social") return "S";
  if (pillar === "Governance") return "G";
  return pillar;
}

/* ---------------- answer normalization ---------------- */
function scoreToLabel(score) {
  if (score === 0) return "Not in place";
  if (score === 1) return "Informal / ad hoc";
  if (score === 2) return "Partially structured";
  if (score === 3) return "Implemented & documented";
  if (score === 4) return "Advanced / best practice";
  return "Not answered";
}

function normalizeAnswer(val) {
  if (val && typeof val === "object" && typeof val.score === "number") {
    let s = val.score;
    if (s < 0) s = 0;
    if (s > 4) s = 4;
    return {
      score: s,
      label: val.label || val.answerLabel || scoreToLabel(s),
    };
  }

  if (val && typeof val === "object" && typeof val.answerScore === "number") {
    let s = val.answerScore;
    if (s < 0) s = 0;
    if (s > 4) s = 4;
    return {
      score: s,
      label: val.answerLabel || val.label || scoreToLabel(s),
    };
  }

  if (typeof val === "number") {
    let s = val;
    if (s < 0) s = 0;
    if (s > 4) s = 4;
    return { score: s, label: scoreToLabel(s) };
  }

  if (val === "Yes") return { score: 4, label: "Yes (fully in place)" };
  if (val === "No") return { score: 0, label: "No (not in place)" };
  if (val === "Unknown") return { score: 0, label: "Unknown" };
  if (val === "Partial") return { score: 2, label: "Partially structured" };

  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();

    if (lower === "not in place") {
      return { score: 0, label: "Not in place" };
    }

    if (lower === "informal / ad hoc" || lower === "informal/ad hoc") {
      return { score: 1, label: "Informal / ad hoc" };
    }

    if (lower === "partially structured") {
      return { score: 2, label: "Partially structured" };
    }

    if (
      lower === "implemented & documented" ||
      lower === "implemented and documented"
    ) {
      return { score: 3, label: "Implemented & documented" };
    }

    if (
      lower === "advanced / best practice" ||
      lower === "advanced/best practice"
    ) {
      return { score: 4, label: "Advanced / best practice" };
    }
  }

  return null;
}

/* ---------------- canonical answers map from any incoming shape ---------------- */
function coerceAnswersMapForDetails(sector, incomingAnswers) {
  const questions = getQuestionsForSector(sector || "") || [];

  if (!incomingAnswers) return {};

  if (!Array.isArray(incomingAnswers) && typeof incomingAnswers === "object") {
    return incomingAnswers;
  }

  if (Array.isArray(incomingAnswers)) {
    const out = {};

    incomingAnswers.forEach((item, idx) => {
      const q = questions[idx];
      if (!q) return;

      const normalized =
        normalizeAnswer(item) ||
        normalizeAnswer(item?.answer) ||
        normalizeAnswer({
          score: item?.score ?? item?.answerScore ?? item?.numericScore,
          label: item?.answerLabel ?? item?.label,
        });

      if (normalized) {
        out[q.id] = normalized;
      }
    });

    return out;
  }

  return {};
}

/* ---------------- array used for score calculations / current page ---------------- */
function buildAnswersArrayFromMap(sector, rawAnswersMap) {
  const qs = getQuestionsForSector(sector || "") || [];
  const raw = rawAnswersMap || {};

  return qs.map((q) => {
    const norm = normalizeAnswer(raw[q.id]);
    const score = norm ? norm.score : 0;

    const pillar = q.pillar || q.esg || q.category;

    let category = "Environmental";
    if (pillar === "S" || pillar === "Social") category = "Social";
    else if (pillar === "G" || pillar === "Governance") {
      category = "Governance";
    }

    return {
      questionId: q.id,
      questionText: q.text,
      question: { category },
      score,
      answerLabel: norm ? norm.label : "Not answered",
    };
  });
}

export default function DetailsPage() {
  const { assessmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { language, benchmarkRegion } = useUserSettings();
  const t = DETAILS_TRANSLATIONS[language] || DETAILS_TRANSLATIONS.en;

  const initialRef = useRef({
    sector: location.state?.sector || "",
    answers: location.state?.answers ?? location.state?.answersMap ?? null,
  });

  const seededSector = initialRef.current.sector || "";
  const seededAnswersRaw = initialRef.current.answers;

  const seededAnswersMap = useMemo(() => {
    return coerceAnswersMapForDetails(seededSector, seededAnswersRaw);
  }, [seededSector, seededAnswersRaw]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [sector, setSector] = useState(seededSector);
  const [answersMap, setAnswersMap] = useState(seededAnswersMap);
  const [profile, setProfile] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [storedScores, setStoredScores] = useState(null);

  const benchmarkSubtitle = useMemo(() => {
    return benchmarkRegion === "it"
      ? t.benchmarkSubtitleIT
      : benchmarkRegion === "global"
      ? t.benchmarkSubtitleGlobal
      : t.benchmarkSubtitleEU;
  }, [
    benchmarkRegion,
    t.benchmarkSubtitleEU,
    t.benchmarkSubtitleGlobal,
    t.benchmarkSubtitleIT,
  ]);

  const categoryLabelMap = useMemo(
    () => ({
      Environmental: t.envLabel,
      Social: t.socLabel,
      Governance: t.govLabel,
    }),
    [t.envLabel, t.socLabel, t.govLabel]
  );

  const pillarCodeLabelMap = useMemo(
    () => ({
      E: t.envLabel,
      S: t.socLabel,
      G: t.govLabel,
    }),
    [t.envLabel, t.socLabel, t.govLabel]
  );

  const categoryWeights = useMemo(() => {
    return (
      SECTOR_WEIGHTS[sector] || {
        Environmental: 0.33,
        Social: 0.33,
        Governance: 0.34,
      }
    );
  }, [sector]);

  const sectorQuestions = useMemo(() => {
    return getQuestionsForSector(sector || "") || [];
  }, [sector]);

  const answers = useMemo(() => {
    return buildAnswersArrayFromMap(sector, answersMap);
  }, [sector, answersMap]);

  /* ---------------- Load assessment/profile ---------------- */
  useEffect(() => {
    (async () => {
      const u = auth.currentUser;

      if (!u) {
        navigate("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        setProfile(userData.profile || {});
      } catch (err) {
        console.error("Failed to load user profile", err);
        setProfile({});
      }

      if (
        seededSector &&
        Object.keys(seededAnswersMap).length > 0 &&
        !assessmentId
      ) {
        setSector(seededSector);
        setAnswersMap(seededAnswersMap);
        setLoading(false);
        return;
      }

      if (!assessmentId) {
        setLoadError("Missing assessment identifier.");
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(
          doc(db, "users", u.uid, "assessments", assessmentId)
        );

        if (!snap.exists()) {
          setLoadError("Assessment not found.");
          setLoading(false);
          return;
        }

        const data = snap.data() || {};

        const hasStored =
          typeof data.overallScore === "number" &&
          typeof data.envScore === "number" &&
          typeof data.socScore === "number" &&
          typeof data.govScore === "number";

        setStoredScores(
          hasStored
            ? {
                overallScore: data.overallScore,
                envScore: data.envScore,
                socScore: data.socScore,
                govScore: data.govScore,
              }
            : null
        );

        setSector(data.sector || "");
        setAnswersMap(data.answers || {});
        setLoading(false);
      } catch (e) {
        console.error("Error loading assessment for details", e);
        setLoadError("Failed to load assessment data.");
        setLoading(false);
      }
    })();
  }, [assessmentId, navigate, seededSector, seededAnswersMap]);

  /* ---------------- Scores ---------------- */
  const computedScoresObj = useMemo(() => {
    const categoryScoresRaw = {
      Environmental: [],
      Social: [],
      Governance: [],
    };

    (answers || []).forEach(({ question, score }) => {
      const cat = question?.category;
      if (!cat || !categoryScoresRaw[cat]) return;

      let numeric = typeof score === "number" ? score : 0;
      numeric = Math.max(0, Math.min(4, numeric));

      categoryScoresRaw[cat].push(numeric);
    });

    const out = {};

    for (const category in categoryScoresRaw) {
      const values = categoryScoresRaw[category];

      if (!values.length) {
        out[category] = 0;
        continue;
      }

      const sum = values.reduce((acc, v) => acc + v, 0);
      const max = values.length * 4;

      out[category] = Math.round((sum / max) * 100);
    }

    return out;
  }, [answers]);

  const scoresObj = useMemo(() => {
    if (storedScores) {
      return {
        Environmental: storedScores.envScore,
        Social: storedScores.socScore,
        Governance: storedScores.govScore,
      };
    }

    return computedScoresObj;
  }, [storedScores, computedScoresObj]);

  const overall = useMemo(() => {
    if (storedScores) return storedScores.overallScore;

    const val =
      (scoresObj.Environmental || 0) * (categoryWeights.Environmental || 0) +
      (scoresObj.Social || 0) * (categoryWeights.Social || 0) +
      (scoresObj.Governance || 0) * (categoryWeights.Governance || 0);

    return Math.round(val * 10) / 10;
  }, [storedScores, scoresObj, categoryWeights]);

  /* ---------------- Corrected critical pillar logic ---------------- */
  const criticalScoreStatus = useMemo(() => {
    return evaluateCriticalScore(scoresObj);
  }, [scoresObj]);

  const hasCriticalPillar = criticalScoreStatus.level === "critical";
  const shouldHideOverallScore = criticalScoreStatus.hideOverallScore;

  const criticalPillarCodes = useMemo(() => {
    return criticalScoreStatus.criticalPillars.map(fullPillarToCode);
  }, [criticalScoreStatus.criticalPillars]);

  const criticalPillarNames = useMemo(() => {
    return criticalScoreStatus.criticalPillars.map(
      (pillar) => categoryLabelMap[pillar] || pillar
    );
  }, [criticalScoreStatus.criticalPillars, categoryLabelMap]);

  useEffect(() => {
    if (hasCriticalPillar) {
      setShowModal(true);
    }
  }, [hasCriticalPillar]);

  const getRating = () => {
    if (hasCriticalPillar) return "❌ Critical ESG gap";
    if (overall >= 80) return "✅ Excellent";
    if (overall >= 60) return "👍 Good";
    if (overall >= 40) return "⚠️ Needs Work";
    return "❌ Critical";
  };

  const normalizedScores = useMemo(
    () => ({
      E: scoresObj.Environmental ?? 0,
      S: scoresObj.Social ?? 0,
      G: scoresObj.Governance ?? 0,
      overall: typeof overall === "number" ? overall : Number(overall) || 0,
    }),
    [scoresObj, overall]
  );

  /* ---------------- Suggestions preview ---------------- */
  const suggestionPreview = useMemo(() => {
    if (!sectorQuestions.length) return [];

    const rawSuggestions = getTailoredSuggestions({
      sector,
      questions: sectorQuestions,
      answers: answersMap,
      profile,
      limit: hasCriticalPillar ? 10 : 5,
      pillarPercents: {
        E: scoresObj.Environmental ?? 0,
        S: scoresObj.Social ?? 0,
        G: scoresObj.Governance ?? 0,
      },
      pillarThreshold: hasCriticalPillar ? CRITICAL_PILLAR_THRESHOLD : 50,
      fallbackLowestNPillars: hasCriticalPillar ? 3 : 2,
    });

    if (!hasCriticalPillar) {
      return rawSuggestions.slice(0, 5);
    }

    const criticalFocused = rawSuggestions.filter((item) =>
      criticalPillarCodes.includes(item.pillar)
    );

    return (criticalFocused.length ? criticalFocused : rawSuggestions).slice(
      0,
      5
    );
  }, [
    sector,
    sectorQuestions,
    answersMap,
    profile,
    scoresObj,
    hasCriticalPillar,
    criticalPillarCodes,
  ]);

  const suggestionPreviewForSave = useMemo(() => {
    return (suggestionPreview || []).slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      text: item.text,
      pillar: item.pillar,
      answerLabel: item.answerLabel,
      impact: item.impact,
      timeframe: item.timeframe,
    }));
  }, [suggestionPreview]);

  /* ---------------- Write summary back to Firestore ---------------- */
  useEffect(() => {
    const saveSummary = async () => {
      if (loading) return;

      const u = auth.currentUser;
      if (!u) return;
      if (!assessmentId) return;

      try {
        const sectorBench = benchmarkData[sector] || null;
        let benchmarkPayload = null;

        if (sectorBench) {
          const sectorAvgE = sectorBench.Environmental ?? null;
          const sectorAvgS = sectorBench.Social ?? null;
          const sectorAvgG = sectorBench.Governance ?? null;

          const wE = categoryWeights.Environmental || 0;
          const wS = categoryWeights.Social || 0;
          const wG = categoryWeights.Governance || 0;
          const sumW = wE + wS + wG || 1;

          const sectorAvgOverall =
            Math.round(
              ((sectorAvgE * wE + sectorAvgS * wS + sectorAvgG * wG) / sumW) *
                10
            ) / 10;

          benchmarkPayload = {
            sectorAvgE,
            sectorAvgS,
            sectorAvgG,
            sectorAvgOverall,
          };
        }

        await updateDoc(doc(db, "users", u.uid, "assessments", assessmentId), {
          sector: sector || profile.sector || null,
          size: profile.size || null,
          country: profile.country || null,
          csrdInScope: profile.csrd === "Yes" || profile.csrdInScope === true,

          overallScore: overall,
          overallScoreHidden: shouldHideOverallScore,
          criticalScoreStatus: {
            level: criticalScoreStatus.level,
            threshold: CRITICAL_PILLAR_THRESHOLD,
            hideOverallScore: shouldHideOverallScore,
            criticalPillars: criticalScoreStatus.criticalPillars,
            weakPillars: criticalScoreStatus.weakPillars,
            imbalanceGap: criticalScoreStatus.imbalanceGap,
          },

          envScore: scoresObj.Environmental ?? 0,
          socScore: scoresObj.Social ?? 0,
          govScore: scoresObj.Governance ?? 0,

          benchmark: benchmarkPayload,
          completedAt: serverTimestamp(),

          turnover: profile.turnover || null,
          goal: profile.goal || null,
          timeline: profile.timeline || null,
          benchmarkRegion: benchmarkRegion || "eu",
          language: language || "en",

          suggestionPreview: suggestionPreviewForSave,
          suggestionCount: suggestionPreviewForSave.length,
        });
      } catch (err) {
        console.error("Failed to update assessment summary:", err);
      }
    };

    saveSummary();
  }, [
    loading,
    assessmentId,
    sector,
    overall,
    shouldHideOverallScore,
    criticalScoreStatus,
    scoresObj,
    categoryWeights,
    benchmarkRegion,
    language,
    profile,
    suggestionPreviewForSave,
  ]);

  /* ---------------- Narrative ---------------- */
  const sectorBenchmark = benchmarkData[sector] || null;

  const sectorBenchmarkOverall = useMemo(() => {
    if (!sectorBenchmark) return null;

    const bE = sectorBenchmark.Environmental ?? 0;
    const bS = sectorBenchmark.Social ?? 0;
    const bG = sectorBenchmark.Governance ?? 0;

    const wE = categoryWeights.Environmental || 0;
    const wS = categoryWeights.Social || 0;
    const wG = categoryWeights.Governance || 0;
    const sumW = wE + wS + wG || 1;

    return Math.round(((bE * wE + bS * wS + bG * wG) / sumW) * 10) / 10;
  }, [sectorBenchmark, categoryWeights]);

  const weakest = useMemo(() => {
    const entries = Object.entries(scoresObj || {});
    if (!entries.length) return { pillar: null, score: null };

    const sorted = [...entries].sort((a, b) => a[1] - b[1]);

    return {
      pillar: sorted[0][0],
      score: sorted[0][1],
    };
  }, [scoresObj]);

  const summaryBullets = useMemo(() => {
    const bullets = [];

    if (hasCriticalPillar) {
      bullets.push({
        id: "critical-hidden",
        text:
          language === "it"
            ? `Il punteggio complessivo non viene mostrato perché ${criticalPillarNames.join(
                ", "
              )} ha un punteggio pari o inferiore al 20%.`
            : `The overall score is not displayed because ${criticalPillarNames.join(
                ", "
              )} scored 20% or below.`,
        tooltip:
          language === "it"
            ? "Una media ponderata potrebbe nascondere una debolezza seria in un pilastro ESG."
            : "A weighted average could hide a serious weakness in one ESG pillar.",
      });

      bullets.push({
        id: "critical-next-step",
        text: t.criticalNextStep,
        tooltip:
          language === "it"
            ? "In caso di gap critico, la priorità non è migliorare tutto, ma correggere prima il pilastro più debole."
            : "When a critical gap exists, the priority is not to improve everything at once, but to fix the weakest pillar first.",
      });

      return bullets;
    }

    if (sectorBenchmarkOverall !== null && !Number.isNaN(overall)) {
      const diff = overall - sectorBenchmarkOverall;

      let posEn = "around the median for";
      let posIt = "intorno alla media per";

      if (diff > 5) {
        posEn = "above the median for";
        posIt = "al di sopra della media per";
      } else if (diff < -5) {
        posEn = "below the median for";
        posIt = "al di sotto della media per";
      }

      const sectorLabel = sector || "your sector";

      bullets.push({
        id: "position",
        text:
          language === "it"
            ? `Ti trovi ${posIt} le PMI ${sectorLabel}.`
            : `You are ${posEn} ${sectorLabel} SMEs.`,
        tooltip:
          language === "it"
            ? "Confronto con un benchmark medio di settore, ponderato su Ambiente, Sociale e Governance."
            : "Comparison against an average sector benchmark, weighted across Environmental, Social and Governance.",
      });
    }

    if (weakest.pillar) {
      const pillarLabel = categoryLabelMap[weakest.pillar] || weakest.pillar;
      const s = weakest.score ?? 0;

      bullets.push({
        id: "weakest",
        text:
          language === "it"
            ? `Area più debole: ${pillarLabel} (${s}%).`
            : `Main weakness: ${pillarLabel} (${s}%).`,
        tooltip:
          language === "it"
            ? "È il pilastro con il punteggio più basso. Intervenire qui ha il maggior impatto sul punteggio complessivo."
            : "This is the lowest-scoring pillar. Improvements here have the biggest impact on your overall score.",
      });

      bullets.push({
        id: "next-step",
        text:
          language === "it"
            ? `Prossimo passo: lavora su ${pillarLabel} e scegli 2–3 azioni nella pagina dei Suggerimenti.`
            : `Next step: focus on ${pillarLabel} and pick 2–3 actions from your Suggestions page.`,
        tooltip:
          language === "it"
            ? "Meglio poche azioni concrete nel pilastro più debole, che un piano teorico impossibile da attuare."
            : "It’s better to start with a few concrete actions in your weakest pillar than a huge plan you never implement.",
      });
    }

    if (!bullets.length && !Number.isNaN(overall)) {
      bullets.push({
        id: "fallback",
        text:
          language === "it"
            ? `Il tuo punteggio ESG complessivo è ${overall}%. Usa la pagina dei Suggerimenti per definire i prossimi passi.`
            : `Your overall ESG score is ${overall}%. Use the Suggestions page to define your next steps.`,
        tooltip:
          language === "it"
            ? "Riepilogo base mostrato quando non sono disponibili benchmark o dettagli aggiuntivi."
            : "Basic summary shown when no benchmark or detailed narrative is available.",
      });
    }

    return bullets;
  }, [
    hasCriticalPillar,
    criticalPillarNames,
    language,
    t.criticalNextStep,
    sectorBenchmarkOverall,
    overall,
    sector,
    weakest,
    categoryLabelMap,
  ]);

  /* ---------------- Actions ---------------- */
  const handleStartOver = () => navigate("/dashboard");

  const handleDownloadPDF = async () => {
    const input = document.getElementById("details-container");
    if (!input) return;

    const scrollY = window.scrollY;

    const canvas = await html2canvas(input, {
      scale: 2,
      scrollY: -scrollY,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`EcoTrack-${sector || "assessment"}-Results.pdf`);
  };

  const goCritical = () => {
    navigate("/critical", {
      state: {
        assessmentId,
        sector,
        answers,
        answersMap,
        questions: sectorQuestions,
        profile,
        scores: normalizedScores,
        threshold: CRITICAL_PILLAR_THRESHOLD,
        criticalScoreStatus,
      },
    });
  };

  const goSuggestions = () => {
    navigate("/suggestions", {
      state: {
        assessmentId,
        sector,
        answers,
        answersMap,
        questions: sectorQuestions,
        profile,
        scores: normalizedScores,
        threshold: CRITICAL_PILLAR_THRESHOLD,
        criticalScoreStatus,
      },
    });
  };

  const goDashboard = () => navigate("/dashboard");

  /* ---------------- Loading / Error UI ---------------- */
  if (loading) {
    return (
      <div className="App fade-in">
        <main className="App-main details-page details-wrapper">
          <div>Loading results…</div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="App fade-in">
        <main className="App-main details-page details-wrapper">
          <p style={{ color: "red", marginBottom: "1rem" }}>{loadError}</p>
          <button className="btn btn--primary" onClick={goDashboard}>
            {t.goDashboard}
          </button>
        </main>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="App fade-in">
      <header className="App-header">
        📊 {t.title} – {sector || "—"}
      </header>

      <main className="App-main details-page details-wrapper">
        <div id="details-container" className="score-card">
          <h2 style={{ marginBottom: "0.5rem" }}>{t.subtitle}</h2>

          <div className="chart-wrapper" style={{ height: 300, width: "100%" }}>
            <ResponsiveContainer>
              <BarChart
                data={Object.entries(scoresObj).map(([k, v]) => ({
                  name: categoryLabelMap[k] || k,
                  value: v,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {!shouldHideOverallScore ? (
            <>
              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>
                  🌟{" "}
                  <strong>
                    {t.overallScoreLabel}: {overall}%
                  </strong>{" "}
                  ({getRating()})
                </span>

                <InfoTooltip>
                  {language === "it" ? (
                    <>
                      <strong>Come calcoliamo il punteggio complessivo</strong>
                      <br />
                      Il punteggio combina Ambiente, Sociale e Governance usando
                      pesi diversi in base al settore selezionato.
                    </>
                  ) : (
                    <>
                      <strong>How we calculate the overall score</strong>
                      <br />
                      The score combines Environmental, Social and Governance
                      using different weights depending on your selected sector.
                    </>
                  )}
                </InfoTooltip>
              </div>

              <p
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.9rem",
                  color: "#555",
                }}
              >
                🧮 {t.appliedWeightsLabel}: {t.envLabel}:{" "}
                {(categoryWeights.Environmental * 100).toFixed(0)}% |{" "}
                {t.socLabel}: {(categoryWeights.Social * 100).toFixed(0)}% |{" "}
                {t.govLabel}: {(categoryWeights.Governance * 100).toFixed(0)}%
              </p>
            </>
          ) : (
            <section
              style={{
                marginTop: "2rem",
                padding: "1rem 1.25rem",
                borderRadius: "12px",
                border: "1px solid #fecaca",
                backgroundColor: "#fef2f2",
                textAlign: "left",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                🚨 {t.overallHiddenTitle}
              </h3>

              <p
                style={{
                  marginTop: 0,
                  fontSize: "0.92rem",
                  lineHeight: 1.5,
                  color: "#7f1d1d",
                }}
              >
                {t.overallHiddenBody}
              </p>

              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.92rem",
                  color: "#7f1d1d",
                }}
              >
                <strong>{t.criticalPillarsLabel}:</strong>{" "}
                {criticalPillarNames.join(", ")}
              </p>

              <p
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#7f1d1d",
                }}
              >
                🧮 {t.appliedWeightsLabel}: {t.envLabel}:{" "}
                {(categoryWeights.Environmental * 100).toFixed(0)}% |{" "}
                {t.socLabel}: {(categoryWeights.Social * 100).toFixed(0)}% |{" "}
                {t.govLabel}: {(categoryWeights.Governance * 100).toFixed(0)}%
              </p>
            </section>
          )}

          <section
            style={{
              marginTop: "1.75rem",
              padding: "1rem 1.25rem",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                }}
              >
                🧠 {t.whatThisMeansTitle}
              </h3>

              <InfoTooltip>
                <strong>
                  {language === "it"
                    ? "Come leggere questo riepilogo"
                    : "How to read this summary"}
                </strong>
                <br />
                {t.whatThisMeansIntro}
              </InfoTooltip>
            </div>

            <ul
              style={{
                margin: "0.35rem 0 0",
                paddingLeft: "1.1rem",
                fontSize: "0.9rem",
                lineHeight: 1.5,
              }}
            >
              {summaryBullets.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span>{item.text}</span>
                  <InfoTooltip>
                    <span>{item.tooltip}</span>
                  </InfoTooltip>
                </li>
              ))}
            </ul>
          </section>

          <h3 style={{ marginTop: "2rem" }}>📂 {t.breakdownTitle}</h3>

          <p
            style={{
              marginTop: "0.25rem",
              fontSize: "0.85rem",
              color: "#555",
            }}
          >
            {t.benchmarkTitle}: {benchmarkSubtitle}
          </p>

          <ul style={{ textAlign: "left", padding: "0 1.5rem" }}>
            {Object.entries(scoresObj).map(([category, score]) => {
              const isCritical =
                typeof score === "number" &&
                !Number.isNaN(score) &&
                score <= CRITICAL_PILLAR_THRESHOLD;

              return (
                <li key={category} style={{ marginBottom: "0.75rem" }}>
                  <strong>{categoryLabelMap[category] || category}:</strong>{" "}
                  <span
                    style={{
                      fontWeight: isCritical ? 700 : 400,
                      color: isCritical ? "#b91c1c" : "inherit",
                    }}
                  >
                    {score}%
                  </span>
                  {isCritical && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      Critical
                    </span>
                  )}
                  <span
                    title={
                      category === "Environmental"
                        ? "Reflects how well your company manages energy, emissions, and resource use."
                        : category === "Social"
                        ? "Measures practices regarding employee welfare, community engagement, and human rights."
                        : "Evaluates corporate policies, board structure, and ethical conduct."
                    }
                    style={{
                      marginLeft: "0.5rem",
                      cursor: "help",
                      fontSize: "1rem",
                      color: "#555",
                    }}
                  >
                    ℹ️
                  </span>
                  <div style={{ fontSize: "0.9rem", color: "#777" }}>
                    {t.industryAverageLabel}:{" "}
                    {benchmarkData[sector]?.[category] ?? "N/A"}%
                  </div>
                </li>
              );
            })}
          </ul>

          {suggestionPreview.length > 0 && (
            <>
              <h3 style={{ marginTop: "2rem" }}>🔍 {t.suggestionsTitle}</h3>

              {hasCriticalPillar && (
                <p
                  style={{
                    textAlign: "left",
                    padding: "0 1.5rem",
                    fontSize: "0.9rem",
                    color: "#7f1d1d",
                  }}
                >
                  {language === "it"
                    ? "Poiché è stato rilevato un gap critico, i suggerimenti sono prioritariamente orientati al pilastro critico."
                    : "Because a critical gap was detected, suggestions are prioritized toward the critical pillar."}
                </p>
              )}

              <div style={{ textAlign: "left", padding: "0 1.5rem" }}>
                {suggestionPreview.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      marginBottom: "1rem",
                      padding: "0.9rem 1rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {item.title}
                    </div>

                    <div
                      style={{
                        fontSize: "0.92rem",
                        lineHeight: 1.5,
                        color: "#334155",
                        marginBottom: 8,
                      }}
                    >
                      {item.text}
                    </div>

                    <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                      <strong>
                        {pillarCodeLabelMap[item.pillar] || item.pillar}
                      </strong>
                      {" • "}
                      {item.answerLabel}
                      {" • "}
                      {item.impact}
                      {" • "}
                      {item.timeframe}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div
          className="details-buttons"
          style={{
            marginTop: "3rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button className="start-button" onClick={handleStartOver}>
            🔁 {t.startOver}
          </button>

          <button className="outline-button" onClick={handleDownloadPDF}>
            📄 {t.downloadPdf}
          </button>

          <button className="btn btn--primary" onClick={goSuggestions}>
            💡 {t.seeSuggestions}
          </button>

          <button className="btn" onClick={goDashboard}>
            🏠 {t.goDashboard}
          </button>

          {hasCriticalPillar && (
            <button className="btn btn--danger" onClick={goCritical}>
              🚨 {t.openCriticalReview}
            </button>
          )}
        </div>

        {showModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "2rem",
                borderRadius: "10px",
                width: "90%",
                maxWidth: "440px",
                textAlign: "center",
              }}
            >
              <h3>⚠️ {t.criticalAlertTitle}</h3>

              <p
                style={{
                  marginTop: "1rem",
                  fontSize: "0.95rem",
                  lineHeight: 1.5,
                }}
              >
                {t.criticalAlertBody}
              </p>

              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.95rem",
                }}
              >
                <strong>{t.criticalPillarsLabel}:</strong>{" "}
                {criticalPillarNames.join(", ")}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  marginTop: "1.25rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setShowModal(false);
                    goCritical();
                  }}
                >
                  {t.openCriticalReview}
                </button>

                <button className="btn" onClick={() => setShowModal(false)}>
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



