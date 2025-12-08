// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../components/landing.css";
import NewAssessmentButton from "../components/NewAssessmentButton";

// Tooltip
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

// 🔗 Viridis commercial CTA target
const VIRIDIS_CTA_URL = "https://www.viridisconsultancy.com";

/* ---------- HELPERS ---------- */
function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}
const median = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid + 0]) / 2);
};

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

// NEW: maturity level helper
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
          <span>{title}</span>
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
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [sector, setSector] = useState(null);
  const [country, setCountry] = useState("");
  const [userName, setUserName] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [peerMedian, setPeerMedian] = useState(null);
  const [peerSeries, setPeerSeries] = useState([]);

  // 🔔 reminder banner state
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

  // 🔹 Simple breakpoint for responsiveness
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
      setCountry(userData.profile?.country || "");

      // Load assessments (latest 12)
      const col = collection(db, "users", u.uid, "assessments");
      const qRecent = query(col, orderBy("createdAt", "desc"), limit(12));
      const recentSnap = await getDocs(qRecent);
      const rows = recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAssessments(rows);
      setSector(rows[0]?.sector || userData.profile?.sector || null);

      // 🔔 Reminder logic
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

      // Live listener placeholder
      try {
        const qLatestSubmitted = query(
          col,
          where("status", "==", "submitted"),
          orderBy("updatedAt", "desc"),
          limit(1)
        );
        unsubLock = onSnapshot(qLatestSubmitted, (s) => {
          if (s.empty) return;
          const data = s.docs[0].data() || {};
          const ts =
            data.updatedAt?.toDate?.() ||
            data.createdAt?.toDate?.() ||
            null;
          // currently unused, but keeping hook for future live UX
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
      .filter((a) => a.status === "submitted" && a.answers)
      .map((a) => {
        const s = scoreAssessment(
          getQuestionsForSector(a.sector || sector || ""),
          a.answers,
          { sector: a.sector || sector || "" }
        );
        return {
          id: a.id,
          date: a.createdAt?.toDate ? a.createdAt.toDate() : new Date(),
          overall: s.overall,
          pillars: s.pillars,
          rating: s.rating,
          sector: a.sector,
          answers: a.answers,
          status: a.status,
        };
      })
      .sort((a, b) => a.date - b.date);
  }, [assessments, sector]);

  // 🔹 Peer line (still mostly placeholder with sector-based fallback)
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

    const xDates = (series && series.length
      ? series
      : [{ date: new Date() }]
    ).map((s) => s.date);
    setPeerSeries(xDates.map((d) => ({ x: d, y: m })));
  }, [sector, series]);

  const latest = series[series.length - 1];
  const previous = series.length >= 2 ? series[series.length - 2] : null;

  const overallScore = latest?.overall ?? 0;
  const overallRating = latest?.rating ?? "—";
  const lastDate = latest?.date ? latest.date.toLocaleDateString() : "—";
  const pillars = latest?.pillars ?? { E: 0, S: 0, G: 0 };

  // NEW: maturity level (based on overallScore)
  const maturity = useMemo(
    () =>
      typeof overallScore === "number" && !Number.isNaN(overallScore)
        ? getMaturityLevel(overallScore)
        : null,
    [overallScore]
  );

  // 🔹 deltas vs previous assessment
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

  const sectorSuggestions = useMemo(
    () =>
      getTailoredSuggestions({
        sector,
        questions,
        answers: latestAssessmentDoc?.answers || {},
        limit: 16,
        country,
      }),
    [sector, questions, latestAssessmentDoc, country]
  );

  // NEW: Top 3 Weak Spots (lowest-scoring questions in latest assessment)
  const weakSpots = useMemo(() => {
    if (!latestAssessmentDoc || !questions.length) return [];

    const answers = latestAssessmentDoc.answers || {};
    const rows = [];

    questions.forEach((q) => {
      const raw = answers[q.id];
      const norm = normalizeAnswer(raw);
      if (!norm) return;

      // map 0–4 scale to 0–100%
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

  /* ---------- PDF Export (with CTA page) ---------- */
  const handleExportPDF = () => {
    const u = auth.currentUser;
    const email = u?.email || "";
    const today = new Date();
    const dateStr = today.toLocaleString();
    const assessmentId =
      latestAssessmentDoc ? latestAssessmentDoc.id : assessments[0]?.id || "n/a";
    const pdf = new jsPDF({ compress: true, unit: "pt", format: "a4" });

    pdf.setProperties({
      title: "EcoTrack — ESG Assessment Report",
      subject: `ESG Report (${sector || "-"})`,
      author: "EcoTrack by Viridis",
      keywords: "ESG, sustainability, assessment, EcoTrack, Viridis",
      creator: "EcoTrack by Viridis",
    });

    const PAGE = {
      w: pdf.internal.pageSize.getWidth(),
      h: pdf.internal.pageSize.getHeight(),
      l: 56,
      r: 56,
      t: 64,
      b: 56,
    };

    const disclaimer =
      "Disclaimer: EcoTrack is an internal self-assessment tool intended to provide a preliminary indication of a company’s ESG performance. It is not a certified audit, accredited verification, or third-party assurance. All results are indicative and should not be used as a substitute for formal ESG assessments conducted by qualified professionals.";

    const TOC = [];
    const addTOC = (title) =>
      TOC.push({ title, page: pdf.getCurrentPageInfo().pageNumber });

    const renderFooter = () => {
      const pageCount = pdf.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);

        pdf.setFontSize(9);
        pdf.setTextColor(80);
        pdf.text(
          `Generated with EcoTrack by Viridis • ${dateStr} • Page ${i}/${pageCount}`,
          PAGE.l,
          PAGE.h - 34
        );

        pdf.setFontSize(7);
        pdf.setTextColor(100);
        const disclaimerLines = pdf.splitTextToSize(
          disclaimer,
          PAGE.w - PAGE.l - PAGE.r
        );
        pdf.text(disclaimerLines, PAGE.l, PAGE.h - 18);
      }
    };

    // COVER
    pdf.setFillColor(17, 24, 39);
    pdf.rect(0, 0, PAGE.w, 140, "F");
    pdf.setTextColor(255);
    pdf.setFontSize(24);
    pdf.text("ESG Assessment Report", PAGE.l, 60);
    pdf.setFontSize(12);
    pdf.text("EcoTrack by Viridis", PAGE.l, 82);
    pdf.setFontSize(10);
    pdf.text(`Generated on: ${dateStr}`, PAGE.l, 102);

    // Info box
    pdf.setTextColor(0);
    autoTable(pdf, {
      startY: 160,
      head: [["Field", "Value"]],
      body: [
        ["Organization", userName || "-"],
        ["Email", email],
        ["Sector", sector || "-"],
        ["Country", country || "-"],
        ["Last Assessment", lastDate],
        ["Assessment ID", assessmentId],
        ["Version", "v1.0"],
      ],
      styles: { fontSize: 10, cellPadding: 6, lineWidth: 0.1, lineColor: 230 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "grid",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: {
        0: { cellWidth: 140 },
        1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - 140 },
      },
    });

    // TOC placeholder
    pdf.addPage();
    const tocPageNo = pdf.getCurrentPageInfo().pageNumber;
    centeredTitle(pdf, "Table of Contents", PAGE);

    // EXECUTIVE SUMMARY
    pdf.addPage();
    addTOC("Executive Summary");
    centeredTitle(pdf, "Executive Summary", PAGE);

    const pillarLabels = { E: "Environmental", S: "Social", G: "Governance" };
    const pillarAtRiskKey =
      Object.entries(pillars).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "E";
    const pillarAtRiskLabelText = `${pillarLabels[pillarAtRiskKey]} ${
      pillars[pillarAtRiskKey]
    }%`;
    const rag = (v) => (v >= 75 ? "Green" : v >= 50 ? "Amber" : "Red");

    autoTable(pdf, {
      startY: PAGE.t + 20,
      head: [["Metric", "Value"]],
      body: [
        ["Overall ESG Score", `${overallScore}%`],
        ["Overall ESG Rating", `${overallRating}`],
        ["Pillar at Risk", pillarAtRiskLabelText],
        ["Assessments in Series", `${series.length}`],
      ],
      styles: { fontSize: 10, cellPadding: 6, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - 220 },
      },
    });

    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || PAGE.t + 40) + 10,
      head: [["Pillar", "Score", "RAG"]],
      body: [
        ["Environmental", `${pillars.E}%`, rag(pillars.E)],
        ["Social", `${pillars.S}%`, rag(pillars.S)],
        ["Governance", `${pillars.G}%`, rag(pillars.G)],
      ],
      styles: { fontSize: 10, cellPadding: 6, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "grid",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: {
        0: { cellWidth: 200 },
        1: { cellWidth: 100 },
        2: { cellWidth: 120 },
      },
    });

    // Top 3 actions
    const topActions = (sectorSuggestions || []).slice(0, 3);
    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || PAGE.t + 60) + 12,
      head: [["Priority Actions (Top 3)"]],
      body: topActions.length
        ? topActions.map((s) => [
            s.text + (s.tags?.length ? `  (#${s.tags.join(" #")})` : ""),
          ])
        : [["Run your first assessment to unlock tailored actions."]],
      styles: { fontSize: 10, cellPadding: 6, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: { 0: { cellWidth: PAGE.w - PAGE.l - PAGE.r } },
    });

    // RESULTS IN DETAIL
    pdf.addPage();
    addTOC("Results in Detail");
    centeredTitle(pdf, "Results in Detail", PAGE);

    const chartBox = {
      x: PAGE.l,
      y: PAGE.t + 18,
      w: PAGE.w - PAGE.l - PAGE.r,
      h: 140,
    };
    drawTrendChartOnPDF(
      pdf,
      series.map((s) => ({ x: +s.date, y: s.overall })),
      chartBox
    );

    autoTable(pdf, {
      startY: chartBox.y + chartBox.h + 12,
      head: [["Pillar", "Score"]],
      body: [
        ["Environmental", `${pillars.E}%`],
        ["Social", `${pillars.S}%`],
        ["Governance", `${pillars.G}%`],
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "grid",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 100 },
      },
    });

    // Strengths & Gaps
    const lastAns = latestAssessmentDoc?.answers || {};
    const qIndex = Object.fromEntries(questions.map((q) => [q.id, q]));
    const strengths = [];
    const gaps = [];

    Object.entries(lastAns).forEach(([qid, val]) => {
      const q = qIndex[qid];
      if (!q) return;
      const norm = normalizeAnswer(val);
      if (!norm) return;
      if (norm.score >= 3) strengths.push(q.text);
      else if (norm.score <= 1) gaps.push(q.text);
    });

    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || PAGE.t + 200) + 10,
      head: [["Top Strengths", "Top Gaps"]],
      body: Array.from({ length: 3 }).map((_, i) => [
        strengths[i] || "",
        gaps[i] || "",
      ]),
      styles: { fontSize: 10, cellPadding: 6, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: {
        0: { cellWidth: (PAGE.w - PAGE.l - PAGE.r) / 2 - 6 },
        1: { cellWidth: (PAGE.w - PAGE.l - PAGE.r) / 2 - 6 },
      },
    });

    // ACTION PLAN
    pdf.addPage();
    addTOC("Action Plan");
    centeredTitle(pdf, "Action Plan (6–12 months)", PAGE);

    const TAG_PILLAR = {
      energy: "E",
      "energy-efficiency": "E",
      lighting: "E",
      metering: "E",
      scope2: "E",
      water: "E",
      waste: "E",
      circularity: "E",
      logistics: "E",
      chemicals: "E",
      biodiversity: "E",
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
      metrics: "G",
    };
    const pillarLabelsMap2 = { E: "Environmental", S: "Social", G: "Governance" };
    const pillarAtRiskKey2 =
      Object.entries(pillars).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "E";

    const toActionPlanRows = (sugList) => {
      const rows = [];
      const addM = (d, m) => {
        const nd = new Date(d);
        nd.setMonth(nd.getMonth() + m);
        return nd.toISOString().slice(0, 10);
      };
      sugList.forEach((s, idx) => {
        const tags = s.tags || [];
        const pillarsInSug = new Set(
          tags.map((t) => TAG_PILLAR[t]).filter(Boolean)
        );
        const pKey = [...pillarsInSug][0] || pillarAtRiskKey2;
        const pLabel = pillarLabelsMap2[pKey] || "-";
        const impact =
          pillarsInSug.has(pillarAtRiskKey2) || idx < 3 ? "High" : "Medium";
        const effort =
          tags.includes("policy") || tags.includes("governance")
            ? "Low"
            : tags.includes("logistics") || tags.includes("circularity")
            ? "High"
            : "Medium";
        rows.push([
          s.text,
          pLabel,
          tags.length ? `#${tags.join(" #")}` : "—",
          impact,
          effort,
          "—",
          addM(today, 2 + idx),
          "Planned",
        ]);
      });
      return rows;
    };

    const actionRows = toActionPlanRows((sectorSuggestions || []).slice(0, 8));
    autoTable(pdf, {
      startY: PAGE.t + 24,
      head: [
        [
          "Action",
          "Pillar",
          "Tags",
          "Impact",
          "Effort",
          "Owner",
          "Target date",
          "Status",
        ],
      ],
      body: actionRows.length
        ? actionRows
        : [["—", "—", "—", "—", "—", "—", "—", "—"]],
      styles: { fontSize: 9, cellPadding: 5, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      tableWidth: "auto",
      columnStyles: {
        0: { cellWidth: 260 },
        1: { cellWidth: 120 },
        2: { cellWidth: 160 },
        3: { cellWidth: 70 },
        4: { cellWidth: 70 },
        5: { cellWidth: 80 },
        6: { cellWidth: 90 },
        7: { cellWidth: 80 },
      },
    });

    // METHODOLOGY
    pdf.addPage();
    addTOC("Methodology & Scope");
    centeredTitle(pdf, "Methodology & Scope", PAGE);

    const para = (t, y) => {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.ink);
      const lines = pdf.splitTextToSize(t, PAGE.w - PAGE.l - PAGE.r);
      pdf.text(lines, PAGE.l, y);
      return y + lines.length * 12 + 8;
    };
    let y = PAGE.t + 24;
    y = para(
      "Scoring: questions carry per-item weights and critical flags mapped to ESG pillars (E/S/G). Pillar scores are normalized to 0–100 and may be capped if critical controls are missing. Overall score is the sector-weighted average of pillar scores. Rating mapped AAA–CCC.",
      y
    );
    y = para(
      "Boundaries: results cover the organization and activities specified in the questionnaire on the stated date. Data is self-reported and not independently assured.",
      y
    );
    y = para(
      "Assumptions & limitations: where information is missing, conservative assumptions may be applied. This report does not constitute third-party assurance.",
      y
    );

    // WORK WITH VIRIDIS  (commercial CTA page)
    pdf.addPage();
    addTOC("Work with Viridis");
    centeredTitle(pdf, "Work with Viridis", PAGE);

    let y2 = PAGE.t + 24;
    y2 = para(
      "EcoTrack gives you a structured self-assessment and a draft action plan. For many SMEs, the next step is to translate these insights into concrete projects, budgets and responsibilities.",
      y2
    );
    y2 = para(
      "Viridis Consulting can support you with: (1) interpreting these results in the context of your business, (2) prioritising actions for the next 6–12 months, and (3) preparing materials that speak the language of management, banks and investors.",
      y2
    );
    y2 = para(
      "If you want help turning this report into a practical roadmap, you can book a dedicated ESG session with Viridis.",
      y2
    );

    pdf.setFontSize(11);
    pdf.setTextColor(24, 138, 88);
    pdf.text(
      `Learn more: ${VIRIDIS_CTA_URL}`,
      PAGE.l,
      y2 + 12
    );

    // APPENDIX — RESPONSES
    pdf.addPage();
    addTOC("Appendix — Questionnaire Responses");
    centeredTitle(pdf, "Appendix — Questionnaire Responses", PAGE);

    const rowsResp = (getQuestionsForSector(sector) || []).map((q) => {
      const raw = latestAssessmentDoc?.answers?.[q.id];
      const norm = normalizeAnswer(raw);
      const ansLabel = norm ? norm.label : "-";
      return [
        q.pillar === "E"
          ? "Environmental"
          : q.pillar === "S"
          ? "Social"
          : "Governance",
        q.text,
        ansLabel,
        q.critical ? "Yes" : "No",
        (q.tags || []).join(", "),
      ];
    });

    autoTable(pdf, {
      startY: PAGE.t + 24,
      head: [["Pillar", "Question", "Answer", "Critical", "Tags"]],
      body: rowsResp.length ? rowsResp : [["—", "—", "—", "—", "—"]],
      styles: { fontSize: 9, cellPadding: 5, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "grid",
      margin: { left: PAGE.l, right: PAGE.r },
      tableWidth: "auto",
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 300 },
        2: { cellWidth: 80 },
        3: { cellWidth: 70 },
        4: { cellWidth: 140 },
      },
    });

    const tocItems = [
      "Executive Summary",
      "Results in Detail",
      "Action Plan",
      "Methodology & Scope",
      "Work with Viridis",
      "Appendix — Questionnaire Responses",
    ];
    const tocResolved = tocItems.map((title) => {
      const found = TOC.find((t) => t.title === title);
      return [title, found ? found.page : "-"];
    });

    pdf.setPage(tocPageNo);
    autoTable(pdf, {
      startY: PAGE.t + 20,
      head: [["Section", "Page"]],
      body: tocResolved,
      styles: { fontSize: 11, cellPadding: 6, lineHeight: 1.2 },
      headStyles: { fillColor: hexToRgbArr(COLORS.primary), textColor: 255 },
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: { 0: { cellWidth: 340 }, 1: { cellWidth: 60 } },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const pageNum = tocResolved[data.row.index][1];
          if (typeof pageNum === "number") {
            pdf.link(
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              { pageNumber: pageNum }
            );
          }
        }
      },
    });

    renderFooter();

    const fileName = `EcoTrack_ESG_Report_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    pdf.save(fileName);
  };

  // ---------- Pillar at risk (UI) ----------
  const pillarLabelsUI = { E: "Environmental", S: "Social", G: "Governance" };
  const pillarAtRiskKeyUI =
    Object.entries(pillars).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "E";

  const pillarAtRiskValue = Number(pillars[pillarAtRiskKeyUI] || 0);
  const pillarAtRiskLabel = `${pillarLabelsUI[pillarAtRiskKeyUI]} ${pillarAtRiskValue}%`;
  const isPillarCritical = pillarAtRiskValue < 20;

  if (loading) {
    return (
      <div className="landing" style={{ alignItems: "stretch" }}>
        <TopNav />
        <main
          className="landing__main"
          style={{
            maxWidth: 1200,
            width: "100%",
            paddingTop: 80,
          }}
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
        style={{
          maxWidth: 1200,
          width: "100%",
          paddingTop: 80,
        }}
      >
        {/* 🔔 Reminder banner */}
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

        <div
          style={{
            marginTop: 24,
            display: "grid",
            gap: 16,
          }}
        >
          {/* Header */}
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
                style={{
                  opacity: 0.8,
                  fontSize: isMobile ? 13 : 14,
                }}
              >
                Sector: {sector || "—"} • Country: {country || "—"}
              </div>
              <button
                className="btn btn--primary"
                type="button"
                onClick={handleExportPDF}
                style={{
                  whiteSpace: "nowrap",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                Export PDF
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {/* Overall ESG Score + tooltip + NEW maturity level */}
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
                  pillars using sector-specific weights.
                </InfoTooltip>
              </div>
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

              {/* NEW: Maturity badge */}
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
            </Card>

            {/* Last assessment */}
            <Card>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Last Assessment
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: COLORS.dark,
                }}
              >
                {lastDate}
              </div>
            </Card>

            {/* Pillar at Risk + tooltip */}
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
                  This is the ESG pillar (E, S or G) with the lowest score in
                  your latest assessment. It usually indicates where you should
                  start improving.
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
            </Card>

            {/* Sector */}
            <Card>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Sector</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLORS.dark,
                }}
              >
                {sector || "—"}
              </div>
            </Card>
          </div>

          {/* Trend + Suggestions */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "minmax(0, 2fr) minmax(0, 1fr)",
              gap: 12,
            }}
          >
            {/* ESG Score Trend + Progress box */}
            <Card
              title={
                <>
                  <span>ESG Score Trend</span>
                  <InfoTooltip>
                    <strong>How to read this chart</strong>
                    <br />
                    Each point is the overall ESG score of a completed
                    assessment. The dashed line shows a peer median benchmark
                    for your sector.
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
                    Run at least <strong>&nbsp;two submitted assessments&nbsp;</strong>
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

              {/* Progress box */}
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
                  <span
                    style={{
                      fontWeight: 600,
                      color: COLORS.dark,
                    }}
                  >
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

            {/* Suggestions card */}
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
              <ul
                style={{
                  paddingLeft: 18,
                  display: "grid",
                  gap: 8,
                }}
              >
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

          {/* NEW: Top 3 Weak Spots */}
          <Card title="Your Top 3 Weak Spots">
            <p
              style={{
                fontSize: 12,
                color: COLORS.muted,
                marginBottom: 10,
              }}
            >
              These are the three lowest-scoring questions in your latest
              assessment. Fixing them usually gives the biggest ESG improvement.
            </p>

            {weakSpots.length === 0 ? (
              <p
                style={{
                  fontSize: 13,
                  color: COLORS.muted,
                }}
              >
                We couldn’t identify detailed weak spots yet. Complete a fully
                submitted assessment with all questions answered to unlock this
                view.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
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

          {/* 🔗 COMMERCIAL CTA CARD */}
          <Card
            title="Need help turning this into a real ESG roadmap?"
            style={{
              marginTop: 4,
            }}
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
            <p
              style={{
                fontSize: 13,
                color: COLORS.muted,
                marginBottom: 0,
              }}
            >
              EcoTrack gives you a self-assessment and a structured list of
              actions. If you want expert support to prioritise, budget and
              implement these actions, you can book a dedicated ESG session with
              Viridis Consulting.
            </p>
          </Card>

          {/* Pillars + Activity */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "minmax(0, 7fr) minmax(0, 5fr)",
              gap: 12,
            }}
          >
            {/* Pillar Breakdown with tooltip */}
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

            <Card title="Recent Activity">
              <ul style={{ display: "grid", gap: 6 }}>
                {assessments.slice(0, 6).map((a) => {
                  const d = a.createdAt?.toDate
                    ? a.createdAt.toDate()
                    : new Date();
                  return (
                    <li
                      key={a.id}
                      style={{
                        fontSize: 14,
                        color: "#334155",
                        wordBreak: "break-word",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          display: "inline-block",
                          background: COLORS.primary,
                          borderRadius: 999,
                          marginRight: 8,
                        }}
                      />
                      <b>Assessment {a.status}</b> • {a.sector} •{" "}
                      {d.toLocaleString()}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}

/* ===== UI helpers ===== */

function getTrimmed(arr, n) {
  return (arr || []).slice(0, n);
}

function BarRow({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const isCritical = v < 20;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 13,
          color: COLORS.muted,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          height: 10,
          background: COLORS.line,
          borderRadius: 999,
        }}
      >
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
      </div>
    </div>
  );
}

// 🔹 Small pill for deltas in Progress box
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

  const color =
    isUp && !isDown
      ? "#15803D"
      : isDown
      ? "#B91C1C"
      : COLORS.muted;
  const bg =
    isUp && !isDown
      ? "#ECFDF3"
      : isDown
      ? "#FEF2F2"
      : "#F9FAFB";
  const border =
    isUp && !isDown
      ? "#BBF7D0"
      : isDown
      ? "#FECACA"
      : "#E5E7EB";

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
  const w = 800,
    h = 180,
    pad = 28;
  const allPts = series.flatMap((s) =>
    s.data && s.data.length ? s.data : []
  );
  const xs = allPts.map((p) => +p.x);
  const minX = xs.length ? Math.min(...xs) : +new Date();
  const maxX = xs.length ? Math.max(...xs) : minX + 1;
  const minY = 0,
    maxY = 100;

  const xScale = (t) =>
    maxX === minX
      ? pad
      : pad + ((t - minX) / (maxX - minX)) * (w - pad * 2);
  const yScale = (v) =>
    pad + (1 - (v - minY) / (maxY - minY)) * (h - pad * 2);

  const mkPath = (pts) =>
    (pts && pts.length ? pts : [{ x: new Date(), y: 0 }])
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xScale(+p.x)} ${yScale(p.y)}`
      )
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

function drawTrendChartOnPDF(pdf, points, box) {
  const pts = points && points.length ? points : [{ x: +new Date(), y: 0 }];
  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs || [1]);
  const minY = 0,
    maxY = 100;

  const scaleX = (t) =>
    maxX === minX
      ? box.x
      : box.x + ((t - minX) / (maxX - minX)) * box.w;
  const scaleY = (v) =>
    box.y + (1 - (v - minY) / (maxY - minY)) * box.h;

  const lc = hexToRgbArr(COLORS.line);
  pdf.setDrawColor(lc[0], lc[1], lc[2]);
  pdf.rect(box.x, box.y, box.w, box.h);

  pdf.line(box.x, box.y + box.h, box.x + box.w, box.y + box.h);
  pdf.line(box.x, box.y, box.x, box.y + box.h);

  const pc = hexToRgbArr(COLORS.primary);
  pdf.setDrawColor(pc[0], pc[1], pc[2]);
  pdf.setLineWidth(1.5);
  for (let i = 0; i < pts.length - 1; i++) {
    pdf.line(
      scaleX(pts[i].x),
      scaleY(pts[i].y),
      scaleX(pts[i + 1].x),
      scaleY(pts[i + 1].y)
    );
  }
  pts.forEach((pt) => {
    pdf.circle(scaleX(pt.x), scaleY(pt.y), 2, "F");
  });
}

function centeredTitle(pdf, text, PAGE) {
  pdf.setFontSize(16);
  pdf.setTextColor(COLORS.dark);
  const textWidth = pdf.getTextWidth(text);
  const x =
    PAGE.l + (PAGE.w - PAGE.l - PAGE.r - textWidth) / 2;
  pdf.text(text, x, PAGE.t);
}

function hexToRgbArr(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}



