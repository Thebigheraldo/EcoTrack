// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import TopNav from "../components/TopNav";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  onSnapshot,
} from "firebase/firestore";
import { getQuestionsForSector } from "../utils/questions";
import { scoreAssessment } from "../utils/scoring";
import { getTailoredSuggestions } from "../utils/suggestionEngine";
import "../components/landing.css";
import NewAssessmentButton from "../components/NewAssessmentButton";
import { exportAssessmentPDF } from "../utils/exportAssessmentPDF";
import InfoTooltip from "../components/InfoTooltip";

/* ---------- BRAND COLORS ---------- */
const COLORS = {
  primary: "#148A58",
  dark: "#111827",
  ink: "#0A0A0A",
  muted: "#64748B",
  line: "#E2E8F0",
  bgCard: "#FFFFFF",
  critical: "#B91C1C",
};

const CRITICAL_PILLAR_THRESHOLD = 20;

// 🔗 Viridis commercial CTA target
const VIRIDIS_CTA_URL = "https://www.viridisconsultancy.com";

/*
  These routes must match the <Route path="..."> values in App.js.
  Based on your page imports, these are the clean recommended routes:
*/
const LEGAL_LINKS = [
  { to: "/terms-and-conditions", label: "Terms of Use" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/cookie-policy", label: "Cookie Policy" },
  { to: "/dpa", label: "DPA" },
  { to: "/legal-notice", label: "Legal Notice" },
];

/* ---------- HELPERS ---------- */
function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

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

function adaptAnswersForSuggestionEngine(rawAnswers) {
  const answers = rawAnswers || {};
  const out = {};

  for (const [qid, v] of Object.entries(answers)) {
    if (typeof v === "number") {
      out[qid] = v;
      continue;
    }

    if (typeof v === "string") {
      const s = v.trim().toLowerCase();

      if (s === "na" || s === "n/a") out[qid] = "NA";
      else if (s === "unknown") out[qid] = "Unknown";
      else if (s === "no") out[qid] = 0;
      else if (s === "yes") out[qid] = 3;
      else {
        const n = Number(s);
        out[qid] = Number.isNaN(n) ? v : n;
      }

      continue;
    }

    if (!v) {
      out[qid] = "Unknown";
      continue;
    }

    const score =
      typeof v.score === "number"
        ? v.score
        : typeof v.value === "number"
        ? v.value
        : typeof v.points === "number"
        ? v.points
        : null;

    const label = v.label != null ? String(v.label) : "";
    const l = label.trim().toLowerCase();

    if (l === "na" || l === "n/a") out[qid] = "NA";
    else if (l === "unknown") out[qid] = "Unknown";
    else if (l === "no") out[qid] = 0;
    else if (l === "yes") out[qid] = 3;
    else if (score != null) out[qid] = score;
    else out[qid] = "Unknown";
  }

  return out;
}

function getMaturityLevel(scoreRaw) {
  const score =
    typeof scoreRaw === "number" && !Number.isNaN(scoreRaw) ? scoreRaw : 0;

  if (score < 30) {
    return {
      label: "Beginner",
      icon: "🌱",
      bg: "#FEF2F2",
      fg: "#B91C1C",
      description:
        "You’re just getting started. Focus on getting basic ESG foundations in place.",
    };
  }

  if (score < 60) {
    return {
      label: "Developing",
      icon: "📈",
      bg: "#FFF7ED",
      fg: "#C05621",
      description:
        "You have some elements in place, but there are still many gaps to close.",
    };
  }

  if (score < 80) {
    return {
      label: "Advanced",
      icon: "🚀",
      bg: "#ECFEFF",
      fg: "#0E7490",
      description:
        "You have solid ESG practices. The next step is to formalise and optimise.",
    };
  }

  return {
    label: "Leading",
    icon: "🏆",
    bg: "#ECFDF5",
    fg: "#047857",
    description:
      "You’re among the frontrunners. Focus on refinement, disclosure and integration.",
  };
}

/* ---------- UI PRIMITIVES ---------- */
function Card({ children, style, title, footer }) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderRadius: 16,
        border: `1px solid ${COLORS.line}`,
        background: COLORS.bgCard,
        boxShadow: "0 6px 20px rgba(16,24,40,.06)",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontWeight: 600,
            marginBottom: 10,
            borderBottom: `1px solid ${COLORS.line}`,
            paddingBottom: 8,
            color: COLORS.dark,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          {typeof title === "string" ? <span>{title}</span> : title}
        </div>
      )}

      {children}

      {footer && (
        <div
          style={{
            marginTop: 12,
            borderTop: `1px solid ${COLORS.line}`,
            paddingTop: 10,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/* ---------- PAGE ---------- */
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [sector, setSector] = useState(null);
  const [country, setCountry] = useState("");
  const [userName, setUserName] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const [profile, setProfile] = useState({
    sector: "",
    size: "",
    country: "",
    turnover: "",
    csrd: "Unsure",
    goal: "compliance",
    timeline: "6-12",
  });

  const [peerMedian, setPeerMedian] = useState(null);
  const [peerSeries, setPeerSeries] = useState([]);

  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let unsubLock = null;

    (async () => {
      const u = auth.currentUser;

      if (!u) {
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", u.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};

      const name =
        userData.name ||
        userData.profile?.name ||
        (u.email?.split("@")[0] ?? "");

      setUserName(name);

      const p = userData.profile || {};
      setCountry(p.country || "");

      setProfile({
        sector: p.sector || "",
        size: p.size || "",
        country: p.country || "",
        turnover: p.turnover || "",
        csrd: p.csrd || "Unsure",
        goal: p.goal || "compliance",
        timeline: p.timeline || "6-12",
      });

      const col = collection(db, "users", u.uid, "assessments");
      const qRecent = query(col, orderBy("createdAt", "desc"), limit(50));
      const recentSnap = await getDocs(qRecent);
      const rows = recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setAssessments(rows);
      setSector(rows[0]?.sector || p.sector || null);

      const settings = userData.settings || {};
      const wantsReminder = !!settings.remindAssessments;

      if (wantsReminder) {
        const now = new Date();

        let lastDate = null;

        if (userData.lastAssessmentAt?.toDate) {
          lastDate = userData.lastAssessmentAt.toDate();
        } else {
          const submitted = rows.filter((r) => r.status === "submitted");

          if (submitted.length) {
            submitted.sort((a, b) => {
              const da = a.createdAt?.toDate
                ? a.createdAt.toDate()
                : new Date(0);
              const db = b.createdAt?.toDate
                ? b.createdAt.toDate()
                : new Date(0);
              return db - da;
            });

            const latestSubmitted = submitted[0];

            if (latestSubmitted.createdAt?.toDate) {
              lastDate = latestSubmitted.createdAt.toDate();
            }
          }
        }

        if (lastDate) {
          const nextDue = addMonths(lastDate, 6);

          if (now >= nextDue) {
            setShowReminderBanner(true);
            setReminderMessage(
              "It’s been more than 6 months since your last ESG assessment. Consider running a new one to keep your strategy up to date."
            );
          } else {
            setShowReminderBanner(false);
          }
        } else {
          setShowReminderBanner(true);
          setReminderMessage(
            "You enabled reminders but haven’t completed an ESG assessment yet. Start your first assessment to get a baseline."
          );
        }
      } else {
        setShowReminderBanner(false);
      }

      try {
        const qLatestSubmitted = query(
          col,
          where("status", "==", "submitted"),
          orderBy("updatedAt", "desc"),
          limit(1)
        );

        unsubLock = onSnapshot(qLatestSubmitted, (s) => {
          if (s.empty) return;
        });
      } catch (e) {
        console.warn("[Dashboard] live lock listener unavailable.", e);
      }

      setLoading(false);
    })();

    return () => {
      if (typeof unsubLock === "function") unsubLock();
    };
  }, []);

  const questions = useMemo(
    () => (sector ? getQuestionsForSector(sector) : []),
    [sector]
  );

  const series = useMemo(() => {
    return assessments
      .filter((a) => a.status === "submitted")
      .map((a) => {
        const date = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();

        const hasCanonical =
          typeof a.overallScore === "number" &&
          typeof a.envScore === "number" &&
          typeof a.socScore === "number" &&
          typeof a.govScore === "number";

        if (hasCanonical) {
          return {
            id: a.id,
            date,
            overall: a.overallScore,
            pillars: {
              E: a.envScore,
              S: a.socScore,
              G: a.govScore,
            },
            rating: a.rating ?? "—",
            sector: a.sector,
            answers: a.answers || {},
            status: a.status,
            overallScoreHidden: a.overallScoreHidden === true,
            criticalScoreStatus: a.criticalScoreStatus || null,
          };
        }

        const qs = getQuestionsForSector(a.sector || sector || "");
        const s = scoreAssessment(qs, a.answers || {}, {
          sector: a.sector || sector || "",
        });

        return {
          id: a.id,
          date,
          overall: s.overall,
          pillars: s.pillars,
          rating: s.rating ?? "—",
          sector: a.sector,
          answers: a.answers || {},
          status: a.status,
          overallScoreHidden: a.overallScoreHidden === true,
          criticalScoreStatus: a.criticalScoreStatus || null,
        };
      })
      .sort((a, b) => a.date - b.date);
  }, [assessments, sector]);

  useEffect(() => {
    if (!sector) {
      setPeerMedian(null);
      setPeerSeries([]);
      return;
    }

    const fallbackBySector = {
      Manufacturing: 54,
      "Agriculture/Food": 52,
      "Textile/Fashion": 50,
      Tech: 62,
      Finance: 58,
      Construction: 49,
      Furniture: 51,
      Transportation: 47,
    };

    const m = fallbackBySector[sector] ?? 55;
    setPeerMedian(m);

    const xDates = (
      series && series.length ? series : [{ date: new Date() }]
    ).map((s) => s.date);

    setPeerSeries(xDates.map((d) => ({ x: d, y: m })));
  }, [sector, series]);

  const latest = series[series.length - 1];
  const previous = series.length >= 2 ? series[series.length - 2] : null;

  const overallScore = latest?.overall ?? 0;
  const overallRating = latest?.rating ?? "—";
  const lastDate = latest?.date ? latest.date.toLocaleDateString() : "—";
  const pillars = latest?.pillars ?? { E: 0, S: 0, G: 0 };

  const latestAssessmentDoc = useMemo(() => {
    const subs = assessments.filter((a) => a.status === "submitted");

    if (!subs.length) return null;

    subs.sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return db - da;
    });

    return subs[0];
  }, [assessments]);

  const shouldHideDashboardOverall =
    latestAssessmentDoc?.overallScoreHidden === true ||
    latest?.overallScoreHidden === true ||
    latestAssessmentDoc?.criticalScoreStatus?.hideOverallScore === true ||
    latest?.criticalScoreStatus?.hideOverallScore === true;

  const maturity = useMemo(
    () =>
      !shouldHideDashboardOverall &&
      typeof overallScore === "number" &&
      !Number.isNaN(overallScore)
        ? getMaturityLevel(overallScore)
        : null,
    [overallScore, shouldHideDashboardOverall]
  );

  const overallDelta =
    previous && typeof previous.overall === "number"
      ? overallScore - previous.overall
      : null;

  const deltaE =
    previous && previous.pillars
      ? (pillars.E || 0) - (previous.pillars.E || 0)
      : null;

  const deltaS =
    previous && previous.pillars
      ? (pillars.S || 0) - (previous.pillars.S || 0)
      : null;

  const deltaG =
    previous && previous.pillars
      ? (pillars.G || 0) - (previous.pillars.G || 0)
      : null;

  const sectorSuggestions = useMemo(() => {
    const hasRealPillarScores =
      latestAssessmentDoc &&
      typeof pillars?.E === "number" &&
      typeof pillars?.S === "number" &&
      typeof pillars?.G === "number";

    return getTailoredSuggestions({
      sector,
      questions,
      answers: adaptAnswersForSuggestionEngine(
        latestAssessmentDoc?.answers || {}
      ),
      profile,
      limit: 16,
      pillarPercents: hasRealPillarScores ? pillars : null,
      pillarThreshold: 50,
      fallbackLowestNPillars: 2,
    });
  }, [sector, questions, latestAssessmentDoc, profile, pillars]);

  const weakSpots = useMemo(() => {
    if (!latestAssessmentDoc || !questions.length) return [];

    const answers = latestAssessmentDoc.answers || {};
    const rows = [];

    questions.forEach((q) => {
      const raw = answers[q.id];
      const norm = normalizeAnswer(raw);

      if (!norm) return;

      const scorePct = Math.max(
        0,
        Math.min(100, Math.round((norm.score / 4) * 100))
      );

      rows.push({
        id: q.id,
        label: q.shortLabel || q.title || q.text,
        score: scorePct,
        pillar: q.pillar || "E",
      });
    });

    if (!rows.length) return [];

    rows.sort((a, b) => a.score - b.score);
    return rows.slice(0, 3);
  }, [latestAssessmentDoc, questions]);

  const handleDownloadAssessmentPDF = (assessmentOrSeriesItem) => {
    if (!assessmentOrSeriesItem) return;

    const fullAssessment =
      assessments.find((a) => a.id === assessmentOrSeriesItem.id) ||
      assessmentOrSeriesItem;

    const assessmentSector =
      fullAssessment.sector || sector || profile.sector || "";

    const assessmentQuestions = getQuestionsForSector(assessmentSector);

    const hasCanonicalScores =
      typeof fullAssessment.overallScore === "number" &&
      typeof fullAssessment.envScore === "number" &&
      typeof fullAssessment.socScore === "number" &&
      typeof fullAssessment.govScore === "number";

    const calculatedScores = hasCanonicalScores
      ? {
          overall: fullAssessment.overallScore,
          pillars: {
            E: fullAssessment.envScore,
            S: fullAssessment.socScore,
            G: fullAssessment.govScore,
          },
          rating: fullAssessment.rating ?? "—",
        }
      : scoreAssessment(assessmentQuestions, fullAssessment.answers || {}, {
          sector: assessmentSector,
        });

    const pillarPercents = calculatedScores.pillars || {
      E: 0,
      S: 0,
      G: 0,
    };

    const suggestionsForThisAssessment = getTailoredSuggestions({
      sector: assessmentSector,
      questions: assessmentQuestions,
      answers: adaptAnswersForSuggestionEngine(fullAssessment.answers || {}),
      profile: {
        ...profile,
        sector: assessmentSector,
      },
      limit: 16,
      pillarPercents,
      pillarThreshold: 50,
      fallbackLowestNPillars: 2,
    });

    const assessmentForPdf = {
      ...fullAssessment,
      sector: assessmentSector,
      answers: fullAssessment.answers || {},
      questions: assessmentQuestions,

      overallScore: calculatedScores.overall ?? 0,
      overallScoreHidden: fullAssessment.overallScoreHidden === true,
      criticalScoreStatus: fullAssessment.criticalScoreStatus || null,

      envScore: pillarPercents.E ?? 0,
      socScore: pillarPercents.S ?? 0,
      govScore: pillarPercents.G ?? 0,
      rating: calculatedScores.rating ?? fullAssessment.rating ?? "—",

      tailoredSuggestions: suggestionsForThisAssessment,
      suggestions: suggestionsForThisAssessment,
    };

    exportAssessmentPDF(assessmentForPdf, {
      organizationName: userName || "",
      userEmail: auth.currentUser?.email || "",
    });
  };

  const pillarLabelsUI = {
    E: "Environmental",
    S: "Social",
    G: "Governance",
  };

  const pillarAtRiskKeyUI =
    Object.entries(pillars).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "E";

  const pillarAtRiskValue = Number(pillars[pillarAtRiskKeyUI] || 0);
  const pillarAtRiskLabel = `${pillarLabelsUI[pillarAtRiskKeyUI]} ${pillarAtRiskValue}%`;
  const isPillarCritical = pillarAtRiskValue <= CRITICAL_PILLAR_THRESHOLD;

  if (loading) {
    return (
      <div className="landing" style={{ alignItems: "stretch" }}>
        <TopNav />
        <main
          className="landing__main"
          style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}
        >
          <div style={{ marginTop: 24 }}>Loading…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="landing" style={{ alignItems: "stretch" }}>
      <TopNav />

      <main
        className="landing__main"
        style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}
      >
        {showReminderBanner && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #F97316",
              background: "#FFFBEB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 14, color: "#7C2D12" }}>
              🔔 {reminderMessage}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <NewAssessmentButton
                label="Start assessment"
                className="btn btn--primary"
                sector={sector}
              />

              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setShowReminderBanner(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: isMobile ? "flex-start" : "space-between",
              alignItems: isMobile ? "flex-start" : "baseline",
              gap: isMobile ? 8 : 0,
            }}
          >
            <h1
              className="landing__title"
              style={{
                marginBottom: isMobile ? 0 : 4,
                color: COLORS.dark,
                fontSize: isMobile ? 22 : undefined,
              }}
            >
              Welcome, {userName || "there"}
            </h1>

            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: 8,
                alignItems: isMobile ? "flex-start" : "center",
                flexWrap: "wrap",
              }}
            >
              <div
                className="landing__subtitle"
                style={{ opacity: 0.8, fontSize: isMobile ? 13 : 14 }}
              >
                Sector: {sector || "—"} • Country: {country || "—"}
              </div>

              <button
                className="btn btn--primary"
                type="button"
                onClick={() => handleDownloadAssessmentPDF(latestAssessmentDoc)}
                disabled={!latestAssessmentDoc}
                style={{
                  whiteSpace: "nowrap",
                  width: isMobile ? "100%" : "auto",
                  opacity: latestAssessmentDoc ? 1 : 0.6,
                  cursor: latestAssessmentDoc ? "pointer" : "not-allowed",
                }}
              >
                Export latest PDF
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <Card>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Overall ESG Score</span>

                <InfoTooltip>
                  <strong>What this number means</strong>
                  <br />
                  This is the overall ESG score from your latest submitted
                  assessment. It combines Environmental, Social and Governance
                  pillars using sector-specific weights. If a pillar scores 20%
                  or below, the overall score is hidden because the average could
                  be misleading.
                </InfoTooltip>
              </div>

              {shouldHideDashboardOverall ? (
                <>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: COLORS.critical,
                      marginTop: 4,
                    }}
                  >
                    Hidden
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: COLORS.critical,
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    Critical ESG gap detected. Review the weakest pillar before
                    using an overall score.
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: COLORS.dark,
                    }}
                  >
                    {overallScore}%
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: COLORS.muted,
                      marginTop: 2,
                    }}
                  >
                    Rating: {overallRating}
                  </div>

                  {maturity && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: maturity.bg,
                          color: maturity.fg,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <span>{maturity.icon}</span>
                        <span>{maturity.label}</span>
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: COLORS.muted,
                          maxWidth: 260,
                        }}
                      >
                        {maturity.description}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Last Assessment
              </div>

              <div
                style={{ fontSize: 24, fontWeight: 600, color: COLORS.dark }}
              >
                {lastDate}
              </div>
            </Card>

            <Card>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Pillar at Risk</span>

                <InfoTooltip>
                  <strong>Pillar at Risk</strong>
                  <br />
                  This is the ESG pillar with the lowest score in your latest
                  assessment. It usually indicates where you should start
                  improving.
                </InfoTooltip>
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: isPillarCritical ? COLORS.critical : COLORS.dark,
                }}
              >
                {pillarAtRiskLabel}
              </div>

              {isPillarCritical && (
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.critical,
                    marginTop: 4,
                  }}
                >
                  Critical threshold reached
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Sector</div>

              <div
                style={{ fontSize: 18, fontWeight: 600, color: COLORS.dark }}
              >
                {sector || "—"}
              </div>
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "minmax(0, 2fr) minmax(0, 1fr)",
              gap: 12,
            }}
          >
            <Card
              title={
                <>
                  <span>ESG Score Trend</span>

                  <InfoTooltip>
                    <strong>How to read this chart</strong>
                    <br />
                    Each point is the overall ESG score of a completed
                    assessment. The dashed line shows a peer median benchmark for
                    your sector.
                  </InfoTooltip>
                </>
              }
            >
              <div style={{ height: 200, position: "relative" }}>
                {series.length >= 2 ? (
                  <TrendChartMulti
                    series={[
                      {
                        label: "Your company",
                        data: series.map((s) => ({
                          x: s.date,
                          y: s.overall,
                        })),
                        stroke: COLORS.primary,
                      },
                      {
                        label: "Companies like you",
                        data: peerSeries,
                        stroke: "#6B7280",
                        dash: "6 4",
                      },
                    ]}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      color: COLORS.muted,
                      textAlign: "center",
                      padding: "0 24px",
                    }}
                  >
                    Run at least{" "}
                    <strong>&nbsp;two submitted assessments&nbsp;</strong>
                    to see your progress over time.
                  </div>
                )}

                {series.length >= 2 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 12,
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    Peer median:{" "}
                    {peerMedian == null ? "n/a" : `${peerMedian}%`}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 600, color: COLORS.dark }}>
                    Progress since last assessment
                  </span>

                  <span style={{ fontSize: 11, color: COLORS.muted }}>
                    {previous
                      ? `vs ${previous.date.toLocaleDateString()}`
                      : "Only one assessment available"}
                  </span>
                </div>

                {previous ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "minmax(0, 1fr)"
                        : "repeat(4, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <DeltaPill label="Overall" delta={overallDelta} />
                    <DeltaPill label="Environmental" delta={deltaE} />
                    <DeltaPill label="Social" delta={deltaS} />
                    <DeltaPill label="Governance" delta={deltaG} />
                  </div>
                ) : (
                  <div style={{ color: COLORS.muted }}>
                    Complete a second assessment to see how your scores change
                    over time.
                  </div>
                )}
              </div>
            </Card>

            <Card
              title="Suggestions for You"
              style={{ height: "100%" }}
              footer={
                <div
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    style={{ width: isMobile ? "100%" : "auto" }}
                  >
                    {showMore ? "Show less" : "Show more"}
                  </button>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      gap: 8,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    <Link
                      className="btn btn--ghost"
                      to="/suggestions"
                      style={{ width: isMobile ? "100%" : "auto" }}
                    >
                      See All
                    </Link>

                    <NewAssessmentButton
                      label="Improve Score"
                      className="btn btn--ghost"
                      style={{ width: isMobile ? "100%" : "auto" }}
                      sector={sector}
                    />
                  </div>
                </div>
              }
            >
              <ul style={{ paddingLeft: 18, display: "grid", gap: 8 }}>
                {getTrimmed(sectorSuggestions, showMore ? 10 : 4).map((s) => (
                  <li key={s.id} style={{ color: "#334155" }}>
                    {s.text}

                    {!!s.tags?.length && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: COLORS.muted,
                        }}
                      >
                        {s.tags.map((t) => `#${t}`).join(" ")}
                      </span>
                    )}
                  </li>
                ))}

                {!(sectorSuggestions || []).length && (
                  <li style={{ color: COLORS.muted }}>
                    No suggestions available yet.
                  </li>
                )}
              </ul>
            </Card>
          </div>

          <Card title="Your Top 3 Weak Spots">
            <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
              These are the three lowest-scoring questions in your latest
              assessment. Fixing them usually gives the biggest ESG improvement.
            </p>

            {weakSpots.length === 0 ? (
              <p style={{ fontSize: 13, color: COLORS.muted }}>
                We couldn’t identify detailed weak spots yet. Complete a fully
                submitted assessment with all questions answered to unlock this
                view.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {weakSpots.map((ws, idx) => (
                  <div key={ws.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.dark,
                          flex: 1,
                        }}
                      >
                        {idx + 1}. {ws.label}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: COLORS.muted,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ws.score}%
                      </div>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        background: COLORS.line,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(ws.score, 100)
                          )}%`,
                          height: "100%",
                          borderRadius: 999,
                          background:
                            ws.score < 30
                              ? COLORS.critical
                              : ws.score < 60
                              ? "#FACC15"
                              : COLORS.primary,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Need help turning this into a real ESG roadmap?"
            style={{ marginTop: 4 }}
            footer={
              <a
                href={VIRIDIS_CTA_URL}
                target="_blank"
                rel="noreferrer"
                className="btn btn--primary"
              >
                Book a session with Viridis
              </a>
            }
          >
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 0 }}>
              EcoTrack gives you a self-assessment and a structured list of
              actions. If you want expert support to prioritise, budget and
              implement these actions, you can book a dedicated ESG session with
              Viridis Consulting.
            </p>
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "minmax(0, 7fr) minmax(0, 5fr)",
              gap: 12,
            }}
          >
            <Card
              title={
                <>
                  <span>Pillar Breakdown</span>

                  <InfoTooltip>
                    <strong>Pillar scores</strong>
                    <br />
                    Environmental, Social and Governance scores are normalized
                    to 0–100. They are based on your responses and may be capped
                    when critical controls are missing.
                  </InfoTooltip>
                </>
              }
            >
              <BarRow label="Environmental" value={pillars.E} />
              <BarRow label="Social" value={pillars.S} />
              <BarRow label="Governance" value={pillars.G} />
            </Card>

            <Card
              title="Recent Activity"
              footer={
                assessments.length > 6 ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowAllActivity((v) => !v)}
                    style={{ width: isMobile ? "100%" : "auto" }}
                  >
                    {showAllActivity
                      ? "Show fewer assessments"
                      : "Show older assessments"}
                  </button>
                ) : null
              }
            >
              <ul
                style={{
                  display: "grid",
                  gap: 10,
                  paddingLeft: 0,
                  listStyle: "none",
                }}
              >
                {(showAllActivity
                  ? assessments
                  : assessments.slice(0, 6)
                ).map((a) => {
                  const d = a.createdAt?.toDate
                    ? a.createdAt.toDate()
                    : null;

                  const dateLabel = d
                    ? d.toLocaleString()
                    : "Date unavailable";
                  const isSubmitted = a.status === "submitted";

                  return (
                    <li
                      key={a.id}
                      style={{
                        fontSize: 14,
                        color: "#334155",
                        wordBreak: "break-word",
                        padding: "10px 0",
                        borderBottom: `1px solid ${COLORS.line}`,
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        justifyContent: "space-between",
                        alignItems: isMobile ? "flex-start" : "center",
                        gap: 10,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            display: "inline-block",
                            background: isSubmitted
                              ? COLORS.primary
                              : COLORS.muted,
                            borderRadius: 999,
                            marginRight: 8,
                          }}
                        />

                        <b>Assessment {a.status || "draft"}</b> •{" "}
                        {a.sector || "—"} • {dateLabel}
                      </div>

                      {isSubmitted ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleDownloadAssessmentPDF(a)}
                          style={{
                            whiteSpace: "nowrap",
                            width: isMobile ? "100%" : "auto",
                          }}
                        >
                          Download PDF
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: COLORS.muted,
                            whiteSpace: "nowrap",
                          }}
                        >
                          PDF available after submission
                        </span>
                      )}
                    </li>
                  );
                })}

                {!assessments.length && (
                  <li style={{ fontSize: 13, color: COLORS.muted }}>
                    No assessments yet.
                  </li>
                )}
              </ul>
            </Card>
          </div>
        </div>

        <DashboardLegalFooter />

        <Footer />
      </main>
    </div>
  );
}

/* ===== UI helpers ===== */

function DashboardLegalFooter() {
  return (
    <footer
      style={{
        marginTop: "3rem",
        paddingTop: "1.5rem",
        paddingBottom: "1rem",
        borderTop: `1px solid ${COLORS.line}`,
        textAlign: "center",
        fontSize: "0.85rem",
        color: COLORS.muted,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "0.85rem",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {LEGAL_LINKS.map((item, index) => (
          <React.Fragment key={item.to}>
            <Link
              to={item.to}
              style={{
                color: COLORS.primary,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {item.label}
            </Link>

            {index < LEGAL_LINKS.length - 1 && (
              <span style={{ color: "#CBD5E1" }}>•</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </footer>
  );
}

function getTrimmed(arr, n) {
  return (arr || []).slice(0, n);
}

function BarRow({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const isCritical = v <= CRITICAL_PILLAR_THRESHOLD;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>
        {label}
      </div>

      <div style={{ height: 10, background: COLORS.line, borderRadius: 999 }}>
        <div
          style={{
            width: `${v}%`,
            height: "100%",
            borderRadius: 999,
            background: isCritical ? COLORS.critical : COLORS.primary,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          color: isCritical ? COLORS.critical : COLORS.muted,
          marginTop: 4,
        }}
      >
        {v}%
        {isCritical ? " — Critical" : ""}
      </div>
    </div>
  );
}

function DeltaPill({ label, delta }) {
  if (delta == null || Number.isNaN(delta)) {
    return (
      <div
        style={{
          padding: "6px 8px",
          borderRadius: 10,
          background: "#FFF",
          border: "1px solid #E5E7EB",
        }}
      >
        <div style={{ fontSize: 11, color: COLORS.muted }}>{label}</div>
        <div style={{ fontSize: 13, color: COLORS.muted }}>n/a</div>
      </div>
    );
  }

  const d = Math.round(delta * 10) / 10;
  const isUp = d > 0;
  const isDown = d < 0;

  const color = isUp ? "#15803D" : isDown ? "#B91C1C" : COLORS.muted;
  const bg = isUp ? "#ECFDF3" : isDown ? "#FEF2F2" : "#F9FAFB";
  const border = isUp ? "#BBF7D0" : isDown ? "#FECACA" : "#E5E7EB";

  const sign = d > 0 ? "+" : d < 0 ? "" : "";

  return (
    <div
      style={{
        padding: "6px 8px",
        borderRadius: 10,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.muted }}>{label}</div>

      <div style={{ fontSize: 13, fontWeight: 600, color }}>
        {sign}
        {d} pts
      </div>
    </div>
  );
}

function TrendChartMulti({ series }) {
  const w = 800;
  const h = 180;
  const pad = 28;

  const allPts = series.flatMap((s) => (s.data && s.data.length ? s.data : []));
  const xs = allPts.map((p) => +p.x);

  const minX = xs.length ? Math.min(...xs) : +new Date();
  const maxX = xs.length ? Math.max(...xs) : minX + 1;

  const minY = 0;
  const maxY = 100;

  const xScale = (t) =>
    maxX === minX ? pad : pad + ((t - minX) / (maxX - minX)) * (w - pad * 2);

  const yScale = (v) =>
    pad + (1 - (v - minY) / (maxY - minY)) * (h - pad * 2);

  const mkPath = (pts) =>
    (pts && pts.length ? pts : [{ x: new Date(), y: 0 }])
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(+p.x)} ${yScale(p.y)}`)
      .join(" ");

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x="0" y="0" width={w} height={h} fill="#fff" />

      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke={COLORS.line}
      />

      <line
        x1={pad}
        y1={pad}
        x2={pad}
        y2={h - pad}
        stroke={COLORS.line}
      />

      {series.map((s, idx) => (
        <g key={idx}>
          <path
            d={mkPath(s.data)}
            fill="none"
            stroke={s.stroke || COLORS.primary}
            strokeWidth="2"
            strokeDasharray={s.dash || "0"}
          />

          {s.data.map((p, i) => (
            <circle
              key={i}
              cx={xScale(+p.x)}
              cy={yScale(p.y)}
              r="3"
              fill={s.stroke || COLORS.primary}
            >
              <title>
                {new Date(p.x).toLocaleDateString()} — {p.y}%
              </title>
            </circle>
          ))}
        </g>
      ))}

      <g transform={`translate(${pad}, ${pad - 10})`}>
        {series.map((s, i) => (
          <g key={i} transform={`translate(${i * 220}, 0)`}>
            <line
              x1="0"
              y1="6"
              x2="18"
              y2="6"
              stroke={s.stroke || COLORS.primary}
              strokeWidth="2"
              strokeDasharray={s.dash || "0"}
            />

            <text x="24" y="10" fontSize="12" fill="#334155">
              {s.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

