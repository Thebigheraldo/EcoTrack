// src/pages/DetailsPage.js
import React, { useEffect, useMemo, useState } from "react";
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
import { useUserSettings } from "../hooks/useUserSettings";
import jsPDF from "jspdf";

import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getQuestionsForSector } from "../utils/questions";
import InfoTooltip from "../components/InfoTooltip";

// --- Benchmarks aligned to actual sector labels used in the app ---
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
    criticalAlertTitle: "Critical ESG Alert",
    criticalAlertBodyPrefix: "Due to an extremely low score in the",
    criticalAlertBodySuffix:
      "pillar, we strongly suggest re-evaluating your overall ESG strategy.",
    close: "Close",

    whatThisMeansTitle: "What this means",
    whatThisMeansIntro:
      "Short interpretation of your score, benchmark position, and where to start.",
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
    criticalAlertTitle: "Avviso ESG critico",
    criticalAlertBodyPrefix:
      "A causa di un punteggio estremamente basso nel pilastro",
    criticalAlertBodySuffix:
      "consigliamo vivamente di rivedere la tua strategia ESG complessiva.",
    close: "Chiudi",

    whatThisMeansTitle: "Cosa significa",
    whatThisMeansIntro:
      "Una breve interpretazione del tuo punteggio, della posizione rispetto al benchmark e da dove partire.",
  },
};

// Same normalization logic you already use in Dashboard
function normalizeAnswer(val) {
  if (val && typeof val === "object" && typeof val.score === "number") {
    let s = val.score;
    if (s < 0) s = 0;
    if (s > 4) s = 4;
    const label =
      val.label ||
      (s === 0
        ? "Not in place"
        : s === 1
        ? "Informal / ad hoc"
        : s === 2
        ? "Partially structured"
        : s === 3
        ? "Implemented & documented"
        : "Advanced / best practice");
    return { score: s, label };
  }
  if (val === "Yes") return { score: 4, label: "Yes (fully in place)" };
  if (val === "No") return { score: 0, label: "No (not in place)" };
  if (val === "Unknown") return { score: 0, label: "Unknown" };
  if (val === "Partial") return { score: 2, label: "Partially implemented" };
  return null;
}

export default function DetailsPage() {
  const { assessmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { language, benchmarkRegion } = useUserSettings();
  const t = DETAILS_TRANSLATIONS[language] || DETAILS_TRANSLATIONS.en;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sector, setSector] = useState(location.state?.sector || "");
  const [answers, setAnswers] = useState(location.state?.answers || []);

  const [showModal, setShowModal] = useState(false);
  const [criticalPillar, setCriticalPillar] = useState(null);

  // canonical stored scores (0..100): { overallScore, envScore, socScore, govScore }
  const [storedScores, setStoredScores] = useState(null);

  // Sector weights aligned to actual sectors
  const sectorWeights = {
    Manufacturing: { Environmental: 0.5, Social: 0.3, Governance: 0.2 },
    Finance: { Environmental: 0.2, Social: 0.3, Governance: 0.5 },
    "Agriculture/Food": { Environmental: 0.4, Social: 0.4, Governance: 0.2 },
    Tech: { Environmental: 0.25, Social: 0.35, Governance: 0.4 },
    Construction: { Environmental: 0.45, Social: 0.35, Governance: 0.2 },
    Transportation: { Environmental: 0.5, Social: 0.3, Governance: 0.2 },
    "Textile/Fashion": { Environmental: 0.4, Social: 0.4, Governance: 0.2 },
    Furniture: { Environmental: 0.4, Social: 0.4, Governance: 0.2 },
  };

  const benchmarkSubtitle =
    benchmarkRegion === "it"
      ? t.benchmarkSubtitleIT
      : benchmarkRegion === "global"
      ? t.benchmarkSubtitleGlobal
      : t.benchmarkSubtitleEU;

  const categoryLabelMap = {
    Environmental: t.envLabel,
    Social: t.socLabel,
    Governance: t.govLabel,
  };

  // ✅ stable weights object (fixes deps warning)
  const categoryWeights = useMemo(() => {
    return (
      sectorWeights[sector] || {
        Environmental: 0.33,
        Social: 0.33,
        Governance: 0.34,
      }
    );
  }, [sector]);

  // -------- Load assessment from Firestore (if not already passed in state) --------
  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) {
        navigate("/login");
        return;
      }

      // If we already got sector + answers from location.state (fresh from questionnaire),
      // we can skip Firestore to avoid flashing.
      if (sector && answers && answers.length > 0 && !assessmentId) {
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

        const data = snap.data();

        // ✅ Prefer canonical stored scores if present (0..100)
        const hasStored =
          typeof data.overallScore === "number" &&
          typeof data.envScore === "number" &&
          typeof data.socScore === "number" &&
          typeof data.govScore === "number";

        if (hasStored) {
          setStoredScores({
            overallScore: data.overallScore,
            envScore: data.envScore,
            socScore: data.socScore,
            govScore: data.govScore,
          });
        } else {
          setStoredScores(null);
        }

        const sectorFromDoc = data.sector || sector || "";
        const rawAnswers = data.answers || {};

        // Build "answers" array in the shape this component expects:
        const questionsForSector = getQuestionsForSector(sectorFromDoc || "");
        const builtAnswers = questionsForSector.map((q) => {
          const raw = rawAnswers[q.id];
          const norm = normalizeAnswer(raw);
          const score = norm ? norm.score : 0;

          const pillar = q.pillar || q.esg || q.category;
          let category = "Environmental";
          if (pillar === "S" || pillar === "Social") category = "Social";
          else if (pillar === "G" || pillar === "Governance")
            category = "Governance";

          return {
            question: { category },
            score,
            answerLabel: norm ? norm.label : "Not answered",
          };
        });

        setSector(sectorFromDoc);
        setAnswers(builtAnswers);
        setLoading(false);
      } catch (e) {
        console.error("Error loading assessment for details", e);
        setLoadError("Failed to load assessment data.");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  /*
   * ---------- SCORES ----------
   * computedScoresObj: derived from answers[] (fallback only)
   * scoresObj: final pillar % used by UI (canonical first)
   * overall: final overall % used by UI (canonical first)
   */

  const computedScoresObj = useMemo(() => {
    const categoryScoresRaw = { Environmental: [], Social: [], Governance: [] };

    (answers || []).forEach(
      ({ question, score, answerScore, numericScore, answer }) => {
        const cat = question?.category;
        if (!cat || !categoryScoresRaw[cat]) return;

        let numeric =
          typeof score === "number"
            ? score
            : typeof answerScore === "number"
            ? answerScore
            : typeof numericScore === "number"
            ? numericScore
            : answer === "Yes"
            ? 4
            : 0;

        numeric = Math.max(0, Math.min(4, numeric));
        categoryScoresRaw[cat].push(numeric);
      }
    );

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

  // ---------- CRITICAL PILLAR LOGIC (0..100, threshold 20) ----------
  const criticalEntry = useMemo(() => {
    return Object.entries(scoresObj || {}).find(([_, v]) => {
      return typeof v === "number" && !Number.isNaN(v) && v <= 20;
    });
  }, [scoresObj]);

  const hasCriticalPillar = !!criticalEntry;
  const criticalCategory = criticalEntry ? criticalEntry[0] : null;

  useEffect(() => {
    if (hasCriticalPillar) {
      setCriticalPillar(criticalCategory);
      setShowModal(true);
    }
  }, [hasCriticalPillar, criticalCategory]);

  const getRating = () => {
    if (hasCriticalPillar) return "❌ Critical";
    if (overall >= 80) return "✅ Excellent";
    if (overall >= 60) return "👍 Good";
    if (overall >= 40) return "⚠️ Needs Work";
    return "❌ Critical";
  };

  const suggestionsByCategory = {
    Environmental: [
      "Switch to renewable energy sources.",
      "Track and reduce carbon emissions.",
      "Improve waste and water management.",
    ],
    Social: [
      "Promote workplace diversity.",
      "Improve employee health and safety.",
      "Support community initiatives.",
    ],
    Governance: [
      "Appoint an ESG officer.",
      "Improve supply chain transparency.",
      "Enforce an anti-bribery policy.",
    ],
  };

  const lowScoreCategories = useMemo(() => {
    return Object.entries(scoresObj)
      .filter(([_, score]) => (typeof score === "number" ? score < 50 : false))
      .map(([category]) => category);
  }, [scoresObj]);

  // scores passed to other pages (0..100)
  const normalizedScores = useMemo(
    () => ({
      E: scoresObj.Environmental ?? 0,
      S: scoresObj.Social ?? 0,
      G: scoresObj.Governance ?? 0,
      overall: typeof overall === "number" ? overall : Number(overall) || 0,
    }),
    [scoresObj, overall]
  );

  // ---------- WRITE SUMMARY BACK TO FIRESTORE ----------
  useEffect(() => {
    const saveSummary = async () => {
      if (loading) return;
      const u = auth.currentUser;
      if (!u) return;
      if (!assessmentId) return;

      try {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const profile = userData.profile || {};

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
          csrdInScope: profile.csrd === "Yes",

          // ✅ canonical fields (0..100)
          overallScore: overall,
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


        });
      } catch (err) {
        console.error("Failed to update assessment summary:", err);
      }
    };

    saveSummary();
  }, [loading, assessmentId, sector, overall, scoresObj, categoryWeights]);

  // ---------- NARRATIVE DATA FOR "WHAT THIS MEANS" ----------
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

    return (
      Math.round(((bE * wE + bS * wS + bG * wG) / sumW) * 10) / 10
    );
  }, [sectorBenchmark, categoryWeights]);

  const weakest = useMemo(() => {
    const entries = Object.entries(scoresObj || {});
    if (!entries.length) return { pillar: null, score: null };
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);
    return { pillar: sorted[0][0], score: sorted[0][1] };
  }, [scoresObj]);

  const summaryBullets = useMemo(() => {
    const bullets = [];

    // Bullet 1: vs sector median
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

    // Bullet 2: weakest pillar
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

    // Fallback
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
  }, [sectorBenchmarkOverall, overall, sector, language, weakest, categoryLabelMap]);

  // ---------- Actions ----------
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
        sector,
        answers,
        scores: normalizedScores, // 0..100
        threshold: 20, // 20%
      },
    });
  };

  const goSuggestions = () => {
    navigate("/suggestions", {
      state: {
        sector,
        answers,
        scores: normalizedScores, // 0..100
        threshold: 20,
      },
    });
  };

  const goDashboard = () => navigate("/dashboard");

  // ---------- Loading / Error UI ----------
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

  // ---------- UI ----------
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

          {!hasCriticalPillar ? (
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
                🧮 Applied Weights: {t.envLabel}:{" "}
                {(categoryWeights.Environmental * 100).toFixed(0)}% |{" "}
                {t.socLabel}: {(categoryWeights.Social * 100).toFixed(0)}% |{" "}
                {t.govLabel}: {(categoryWeights.Governance * 100).toFixed(0)}%
              </p>

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
            </>
          ) : (
            <p style={{ marginTop: "2rem" }}>
              🌟 <strong>Result:</strong> ❌ Critical
            </p>
          )}

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
            {Object.entries(scoresObj).map(([category, score]) => (
              <li key={category}>
                <strong>{categoryLabelMap[category] || category}:</strong>{" "}
                {score}%
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
            ))}
          </ul>

          {lowScoreCategories.length > 0 && (
            <>
              <h3 style={{ marginTop: "2rem" }}>🔍 {t.suggestionsTitle}</h3>
              {lowScoreCategories.map((category) => (
                <div
                  key={category}
                  style={{
                    textAlign: "left",
                    padding: "0 1.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <strong>{categoryLabelMap[category] || category}</strong>
                  <ul>
                    {(suggestionsByCategory[category] || []).map((tip, i) => (
                      <li key={i}>✅ {tip}</li>
                    ))}
                  </ul>
                </div>
              ))}
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
                maxWidth: "400px",
                textAlign: "center",
              }}
            >
              <h3>⚠️ {t.criticalAlertTitle}</h3>
              <p style={{ marginTop: "1rem" }}>
                {t.criticalAlertBodyPrefix}{" "}
                <strong>
                  "{categoryLabelMap[criticalPillar] || criticalPillar}"
                </strong>{" "}
                {t.criticalAlertBodySuffix}
              </p>

              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
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






