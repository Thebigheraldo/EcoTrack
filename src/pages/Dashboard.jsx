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
import ecotrackLogo from "../assets/ecotrack-logo.png";


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
/* ---------- PDF Export (PRO design) ---------- */
const handleExportPDF = async () => {
  const u = auth.currentUser;
  const email = u?.email || "";
  const today = new Date();
  const dateStr = today.toLocaleString();

  const assessmentId =
    latestAssessmentDoc ? latestAssessmentDoc.id : assessments[0]?.id || "n/a";

  /* ---------- helpers ---------- */
  async function urlToDataURL(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function fitImage(pdf, dataUrl, maxW, maxH) {
    try {
      const p = pdf.getImageProperties(dataUrl);
      const r = p.width / p.height;
      let w = maxW;
      let h = w / r;
      if (h > maxH) {
        h = maxH;
        w = h * r;
      }
      return { w, h };
    } catch {
      return { w: maxW, h: maxH };
    }
  }

  function drawTrendChartOnPDF_Pro(pdf, points, box, palette) {
    const pts = points && points.length ? points : [{ x: +new Date(), y: 0 }];
    const xs = pts.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = 0;
    const maxY = 100;

    const scaleX = (t) =>
      maxX === minX ? box.x : box.x + ((t - minX) / (maxX - minX)) * box.w;
    const scaleY = (v) => box.y + (1 - (v - minY) / (maxY - minY)) * box.h;

    // frame
    pdf.setDrawColor(...palette.line);
    pdf.setLineWidth(1);
    pdf.rect(box.x, box.y, box.w, box.h);

    // grid
    pdf.setDrawColor(...palette.line);
    pdf.setLineWidth(0.6);
    for (let g = 0; g <= 4; g++) {
      const yy = box.y + (box.h * g) / 4;
      pdf.line(box.x, yy, box.x + box.w, yy);

      const label = `${100 - g * 25}%`;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...palette.muted);
      pdf.text(label, box.x - 28, yy + 3);
    }

    // x labels
    const first = new Date(minX).toLocaleDateString();
    const last = new Date(maxX).toLocaleDateString();
    pdf.setFontSize(8);
    pdf.setTextColor(...palette.muted);
    pdf.text(first, box.x, box.y + box.h + 14);
    pdf.text(last, box.x + box.w - pdf.getTextWidth(last), box.y + box.h + 14);

    // trend line
    pdf.setDrawColor(...palette.primary);
    pdf.setLineWidth(1.8);
    for (let i = 0; i < pts.length - 1; i++) {
      pdf.line(
        scaleX(pts[i].x),
        scaleY(pts[i].y),
        scaleX(pts[i + 1].x),
        scaleY(pts[i + 1].y)
      );
    }

    // dots
    pdf.setFillColor(...palette.primary);
    pts.forEach((pt) => pdf.circle(scaleX(pt.x), scaleY(pt.y), 2.4, "F"));
  }

  /* ---------- logo ---------- */
  const logoDataUrl = await urlToDataURL(ecotrackLogo);

  /* ---------- pdf ---------- */
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

  const BRAND = {
    primary: hexToRgbArr(COLORS.primary),
    dark: hexToRgbArr(COLORS.dark),
    ink: hexToRgbArr("#0B1220"),
    muted: hexToRgbArr("#64748B"),
    line: hexToRgbArr("#E2E8F0"),
    bg: hexToRgbArr("#F8FAFC"),
    critical: hexToRgbArr(COLORS.critical),
  };

  const reportMeta = {
    organization: userName || "-",
    email,
    sector: sector || "-",
    country: country || "-",
    lastAssessment: lastDate || "-",
    assessmentId,
    generatedOn: dateStr,
    version: "v1.0",
  };

  const pillarLabels = { E: "Environmental", S: "Social", G: "Governance" };
  const pillarAtRiskKey =
    Object.entries(pillars).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "E";

  const ragColor = (v) =>
    v >= 75
      ? hexToRgbArr("#15803D")
      : v >= 50
      ? hexToRgbArr("#B45309")
      : BRAND.critical;

  const completeness = (() => {
    const qCount = questions?.length || 0;
    if (!qCount) return { answered: 0, total: 0, pct: 0 };
    const ans = latestAssessmentDoc?.answers || {};
    const answered = questions.reduce((acc, q) => {
      const n = normalizeAnswer(ans[q.id]);
      return acc + (n ? 1 : 0);
    }, 0);
    const pct = Math.round((answered / qCount) * 100);
    return { answered, total: qCount, pct };
  })();

  /* ---------- header/footer ---------- */
  const drawHeader = (titleRight = "") => {
    const p = pdf.getCurrentPageInfo().pageNumber;
    if (p === 1) return;

    pdf.setFillColor(...BRAND.bg);
    pdf.rect(0, 0, PAGE.w, 52, "F");

    if (logoDataUrl) {
      const dims = fitImage(pdf, logoDataUrl, 86, 22);
      pdf.addImage(logoDataUrl, "PNG", PAGE.l, 14, dims.w, dims.h);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...BRAND.ink);
    pdf.text("EcoTrack — ESG Assessment Report", PAGE.l + 110, 30);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.muted);
    pdf.text(
      titleRight,
      PAGE.w - PAGE.r - pdf.getTextWidth(titleRight),
      30
    );

    pdf.setDrawColor(...BRAND.line);
    pdf.setLineWidth(1);
    pdf.line(0, 52, PAGE.w, 52);
  };

  const drawFooter = () => {
    const p = pdf.getCurrentPageInfo().pageNumber;
    const total = pdf.getNumberOfPages();

    pdf.setDrawColor(...BRAND.line);
    pdf.setLineWidth(1);
    pdf.line(PAGE.l, PAGE.h - 44, PAGE.w - PAGE.r, PAGE.h - 44);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.muted);

    const left = `${reportMeta.organization} • ${reportMeta.sector} • ${today
      .toISOString()
      .slice(0, 10)}`;
    pdf.text(left, PAGE.l, PAGE.h - 28);

    const right = `Page ${p} of ${total}`;
    pdf.text(right, PAGE.w - PAGE.r - pdf.getTextWidth(right), PAGE.h - 28);
  };

  const newPage = (sectionTitle) => {
    pdf.addPage();
    drawHeader(sectionTitle);
    drawFooter();
    return 80; // content start Y
  };

  const sectionTitle = (title, subtitle, y) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...BRAND.ink);
    pdf.text(title, PAGE.l, y);

    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...BRAND.muted);
      const lines = pdf.splitTextToSize(subtitle, PAGE.w - PAGE.l - PAGE.r);
      pdf.text(lines, PAGE.l, y + 18);
      return y + 18 + lines.length * 12;
    }
    return y + 22;
  };

  const drawKpiTiles = (y) => {
    const gap = 10;
    const tileW = (PAGE.w - PAGE.l - PAGE.r - gap * 3) / 4;
    const tileH = 62;

    const tiles = [
      { label: "Overall Score", value: `${overallScore}%`, accent: BRAND.primary },
      { label: "Rating", value: `${overallRating}`, accent: BRAND.primary },
      {
        label: "Pillar at risk",
        value: `${pillarLabels[pillarAtRiskKey]} (${pillars[pillarAtRiskKey]}%)`,
        accent: ragColor(pillars[pillarAtRiskKey]),
      },
      { label: "Data completeness", value: `${completeness.pct}%`, accent: BRAND.primary },
    ];

    tiles.forEach((t, i) => {
      const x = PAGE.l + i * (tileW + gap);

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...BRAND.line);
      pdf.roundedRect(x, y, tileW, tileH, 10, 10, "FD");

      pdf.setFillColor(...t.accent);
      pdf.roundedRect(x, y, tileW, 6, 10, 10, "F");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...BRAND.muted);
      pdf.text(t.label, x + 12, y + 24);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(...BRAND.ink);
      pdf.text(String(t.value), x + 12, y + 46);
    });

    return y + tileH + 14;
  };

  const drawPillarBars = (y) => {
    const boxH = 110;
    const x = PAGE.l;
    const w = PAGE.w - PAGE.l - PAGE.r;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...BRAND.line);
    pdf.roundedRect(x, y, w, boxH, 12, 12, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...BRAND.ink);
    pdf.text("Pillar breakdown", x + 14, y + 24);

    const bars = [
      { label: "Environmental", v: pillars.E },
      { label: "Social", v: pillars.S },
      { label: "Governance", v: pillars.G },
    ];

    const barX = x + 14;
    const barW = w - 28;
    let yy = y + 42;

    bars.forEach((b) => {
      const v = Math.max(0, Math.min(100, Number(b.v || 0)));
      const c = ragColor(v);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...BRAND.muted);
      pdf.text(b.label, barX, yy);

      pdf.setFillColor(...BRAND.line);
      pdf.roundedRect(barX, yy + 8, barW, 8, 999, 999, "F");

      pdf.setFillColor(...c);
      pdf.roundedRect(barX, yy + 8, (barW * v) / 100, 8, 999, 999, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...BRAND.ink);
      pdf.text(`${v}%`, barX + barW - 24, yy);

      yy += 26;
    });

    return y + boxH + 14;
  };

  const para = (t, yy) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.ink);
    const lines = pdf.splitTextToSize(t, PAGE.w - PAGE.l - PAGE.r);
    pdf.text(lines, PAGE.l, yy);
    return yy + lines.length * 12 + 10;
  };

  /* =========================================================
     COVER
  ========================================================= */
  pdf.setFillColor(...BRAND.dark);
  pdf.rect(0, 0, PAGE.w, PAGE.h, "F");

  pdf.setFillColor(...BRAND.primary);
  pdf.rect(0, 0, PAGE.w, 10, "F");

  if (logoDataUrl) {
    const dims = fitImage(pdf, logoDataUrl, 140, 38);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(PAGE.l, 44, dims.w + 18, dims.h + 14, 10, 10, "F");
    pdf.addImage(logoDataUrl, "PNG", PAGE.l + 9, 51, dims.w, dims.h);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(255, 255, 255);
  pdf.text("ESG Assessment Report", PAGE.l, 130);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(220, 230, 240);
  pdf.text("EcoTrack by Viridis", PAGE.l, 152);

  // Confidential pill
  pdf.setFillColor(255, 255, 255);
  pdf.setTextColor(...BRAND.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  const tag = "CONFIDENTIAL — INTERNAL USE";
  const tagW = pdf.getTextWidth(tag) + 18;
  pdf.roundedRect(PAGE.w - PAGE.r - tagW, 46, tagW, 22, 999, 999, "F");
  pdf.text(tag, PAGE.w - PAGE.r - tagW + 9, 61);

  // At a glance white block
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(PAGE.l, 190, PAGE.w - PAGE.l - PAGE.r, 170, 16, 16, "F");

  pdf.setTextColor(...BRAND.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("At a glance", PAGE.l + 18, 218);

  pdf.setFontSize(44);
  pdf.setTextColor(...BRAND.primary);
  pdf.text(`${overallScore}%`, PAGE.l + 18, 270);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(`Rating: ${overallRating}`, PAGE.l + 20, 292);
  pdf.text(
    `Pillar at risk: ${pillarLabels[pillarAtRiskKey]} (${pillars[pillarAtRiskKey]}%)`,
    PAGE.l + 20,
    310
  );
  pdf.text(
    `Data completeness: ${completeness.answered}/${completeness.total} answered (${completeness.pct}%)`,
    PAGE.l + 20,
    328
  );

  // Pillar chips
  const chip = (x, y, label, value) => {
    const v = Math.max(0, Math.min(100, Number(value || 0)));
    const c = ragColor(v);
    pdf.setFillColor(...c);
    pdf.roundedRect(x, y, 170, 46, 12, 12, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(label, x + 14, y + 20);
    pdf.setFontSize(16);
    pdf.text(`${v}%`, x + 14, y + 38);
  };

  const chipY = 222;
  chip(PAGE.l + 320, chipY, "Environmental", pillars.E);
  chip(PAGE.l + 320, chipY + 54, "Social", pillars.S);
  chip(PAGE.l + 320, chipY + 108, "Governance", pillars.G);

  /* ---------- Report details CARD ---------- */
  const detailsX = PAGE.l;
  const detailsY = 380;
  const detailsW = PAGE.w - PAGE.l - PAGE.r;
  const detailsH = 230;

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(detailsX, detailsY, detailsW, detailsH, 16, 16, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...BRAND.ink);
  pdf.text("Report details", detailsX + 18, detailsY + 28);

  const metaRows = [
    ["Organization", reportMeta.organization],
    ["Email", reportMeta.email],
    ["Sector", reportMeta.sector],
    ["Country", reportMeta.country],
    ["Last assessment", reportMeta.lastAssessment],
    ["Assessment ID", reportMeta.assessmentId],
    ["Generated on", reportMeta.generatedOn],
    ["Version", reportMeta.version],
  ];

  autoTable(pdf, {
    startY: detailsY + 40,
    head: [],
    body: metaRows,
    theme: "plain",
    margin: { left: detailsX + 18, right: PAGE.r + 18 },
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 130, textColor: BRAND.muted },
      1: { cellWidth: detailsW - 36 - 130 },
    },
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(200, 210, 220);
  pdf.text(`Generated on ${dateStr}`, PAGE.l, PAGE.h - 34);

  /* =========================================================
     TOC placeholder
  ========================================================= */
  pdf.addPage();
  drawHeader("Table of Contents");
  drawFooter();
  const tocPageNo = pdf.getCurrentPageInfo().pageNumber;

  let y = 92;
  y = sectionTitle("Table of contents", "Click a section to jump to it.", y);

  const TOC = [];
  const addTOC = (title) =>
    TOC.push({ title, page: pdf.getCurrentPageInfo().pageNumber });

  /* =========================================================
     SCORECARD
  ========================================================= */
  y = newPage("Scorecard");
  addTOC("Scorecard");

  y = sectionTitle(
    "Scorecard",
    "A snapshot of your latest ESG performance and progress over time.",
    y
  );

  y = drawKpiTiles(y);
  y = drawPillarBars(y);

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(...BRAND.line);
  pdf.roundedRect(PAGE.l, y, PAGE.w - PAGE.l - PAGE.r, 210, 12, 12, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND.ink);
  pdf.text("Overall score trend", PAGE.l + 14, y + 24);

  drawTrendChartOnPDF_Pro(
    pdf,
    series.map((s) => ({ x: +s.date, y: s.overall })),
    {
      x: PAGE.l + 14,
      y: y + 40,
      w: PAGE.w - PAGE.l - PAGE.r - 28,
      h: 150,
    },
    { primary: BRAND.primary, line: BRAND.line, muted: BRAND.muted }
  );

  /* =========================================================
     KEY FINDINGS  ✅ FIX: force full-width table like Appendix
  ========================================================= */
  y = newPage("Key Findings");
  addTOC("Key Findings");

  y = sectionTitle(
    "Key findings",
    "Where you are strong, where you are exposed, and what to fix first.",
    y
  );

  const topActions = (sectorSuggestions || []).slice(0, 6).map((s, idx) => {
    const tags = (s.tags || []).slice(0, 4).map((t) => `#${t}`).join(" ");
    return [String(idx + 1), s.text, tags || "—", pillarLabels[pillarAtRiskKey]];
  });

  // ✅ full table width (same logic as Appendix)
  const tableW = PAGE.w - PAGE.l - PAGE.r;
  const KF_COLW = { idx: 24, tags: 120, focus: 70 };
  KF_COLW.action = tableW - KF_COLW.idx - KF_COLW.tags - KF_COLW.focus;

  autoTable(pdf, {
    startY: y,
    head: [["#", "Priority actions (next 6–12 months)", "Tags", "Focus"]],
    body: topActions.length
      ? topActions
      : [["—", "Run an assessment to unlock actions.", "—", "—"]],
    margin: { left: PAGE.l, right: PAGE.r },
    tableWidth: tableW, // ✅ important
    styles: {
      fontSize: 9,
      cellPadding: 6,
      lineColor: BRAND.line,
      lineWidth: 0.2,
      textColor: BRAND.ink,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: KF_COLW.idx, halign: "center" },
      1: { cellWidth: KF_COLW.action },
      2: { cellWidth: KF_COLW.tags, textColor: BRAND.muted },
      3: { cellWidth: KF_COLW.focus, halign: "center" },
    },
    theme: "striped",
    didDrawPage: () => {
      drawHeader("Key Findings");
      drawFooter();
    },
  });

  /* =========================================================
     ACTION PLAN ✅ FIX: force full-width table like Appendix
  ========================================================= */
  y = newPage("Action Plan");
  addTOC("Action Plan");

  y = sectionTitle(
    "Action plan",
    "A practical plan with actions that fit your lowest pillar and quick wins.",
    y
  );

  const actionRows = (sectorSuggestions || []).slice(0, 10).map((s, idx) => {
    const tags = (s.tags || []).slice(0, 3).map((t) => `#${t}`).join(" ");
    const target = (() => {
      const d = new Date(today);
      d.setMonth(d.getMonth() + (idx < 3 ? 2 : idx < 6 ? 4 : 6));
      return d.toISOString().slice(0, 10);
    })();

    const impact = idx < 3 ? "High" : "Medium";
    const effort =
      (s.tags || []).includes("policy") || (s.tags || []).includes("governance")
        ? "Low"
        : (s.tags || []).includes("logistics") ||
          (s.tags || []).includes("circularity")
        ? "High"
        : "Medium";

    const p = (s.tags || []).includes("people")
      ? "Social"
      : (s.tags || []).includes("ethics") ||
        (s.tags || []).includes("transparency")
      ? "Governance"
      : "Environmental";

    return [s.text, tags || "—", p, impact, effort, target, "Planned"];
  });

  // ✅ full table width (same logic as Appendix)
  const AP_TABLEW = tableW;
  const AP_COLW = {
    tags: 90,
    pillar: 55,
    impact: 45,
    effort: 45,
    target: 55,
    status: 48,
  };
  AP_COLW.action =
    AP_TABLEW -
    AP_COLW.tags -
    AP_COLW.pillar -
    AP_COLW.impact -
    AP_COLW.effort -
    AP_COLW.target -
    AP_COLW.status;

  autoTable(pdf, {
    startY: y,
    head: [["Action", "Tags", "Pillar", "Impact", "Effort", "Target", "Status"]],
    body: actionRows.length ? actionRows : [["—", "—", "—", "—", "—", "—", "—"]],
    margin: { left: PAGE.l, right: PAGE.r },
    tableWidth: AP_TABLEW, // ✅ important
    styles: {
      fontSize: 9,
      cellPadding: 6,
      lineColor: BRAND.line,
      lineWidth: 0.2,
      textColor: BRAND.ink,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: AP_COLW.action },
      1: { cellWidth: AP_COLW.tags, textColor: BRAND.muted },
      2: { cellWidth: AP_COLW.pillar, halign: "center" },
      3: { cellWidth: AP_COLW.impact, halign: "center" },
      4: { cellWidth: AP_COLW.effort, halign: "center" },
      5: { cellWidth: AP_COLW.target, halign: "center" },
      6: { cellWidth: AP_COLW.status, halign: "center" },
    },
    theme: "striped",
    didDrawPage: () => {
      drawHeader("Action Plan");
      drawFooter();
    },
  });

  /* =========================================================
     METHODOLOGY
  ========================================================= */
  y = newPage("Methodology");
  addTOC("Methodology & Disclaimer");

  y = sectionTitle(
    "Methodology & disclaimer",
    "How scoring works, what the results mean, and limitations.",
    y
  );

  y = para(
    "Scoring: responses are normalised and aggregated into Environmental, Social and Governance pillars (0–100). Pillar scores may be capped where critical controls are missing. Overall score is a sector-weighted average of the three pillars.",
    y
  );
  y = para(
    "Data quality: results depend on self-reported inputs. Higher completeness and evidence-backed answers increase confidence in the output.",
    y
  );
  y = para(
    "Disclaimer: EcoTrack is an internal self-assessment tool intended to provide a preliminary indication of a company’s ESG performance. It is not a certified audit, accredited verification, or third-party assurance. Results are indicative and should not be used as a substitute for formal ESG assessments conducted by qualified professionals.",
    y
  );

  /* =========================================================
     APPENDIX — RESPONSES
  ========================================================= */
  y = newPage("Appendix");
  addTOC("Appendix — Responses");

  y = sectionTitle(
    "Appendix — questionnaire responses",
    "Full list of questions and answers from the latest submitted assessment.",
    y
  );

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
      (q.tags || []).slice(0, 6).join(", "),
    ];
  });

  const tableW2 = PAGE.w - PAGE.l - PAGE.r;
  const COLW = { pillar: 70, answer: 95, critical: 48, tags: 70 };
  COLW.question = tableW2 - COLW.pillar - COLW.answer - COLW.critical - COLW.tags;

  autoTable(pdf, {
    startY: y,
    head: [["Pillar", "Question", "Answer", "Critical", "Tags"]],
    body: rowsResp.length ? rowsResp : [["—", "—", "—", "—", "—"]],
    margin: { left: PAGE.l, right: PAGE.r },
    tableWidth: tableW2,
    styles: {
      fontSize: 8.2,
      cellPadding: 4,
      lineColor: BRAND.line,
      lineWidth: 0.2,
      textColor: BRAND.ink,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: COLW.pillar },
      1: { cellWidth: COLW.question },
      2: { cellWidth: COLW.answer },
      3: { cellWidth: COLW.critical, halign: "center" },
      4: { cellWidth: COLW.tags, textColor: BRAND.muted },
    },
    theme: "grid",
    didDrawPage: () => {
      drawHeader("Appendix");
      drawFooter();
    },
  });

  /* =========================================================
     TOC real pages + links
  ========================================================= */
  const tocItems = [
    "Scorecard",
    "Key Findings",
    "Action Plan",
    "Methodology & Disclaimer",
    "Appendix — Responses",
  ];

  const tocResolved = tocItems.map((title) => {
    const found = TOC.find((t) => t.title === title);
    return [title, found ? found.page : "-"];
  });

  pdf.setPage(tocPageNo);
  drawHeader("Table of Contents");
  drawFooter();

  autoTable(pdf, {
    startY: 140,
    head: [["Section", "Page"]],
    body: tocResolved,
    styles: {
      fontSize: 11,
      cellPadding: 8,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    theme: "striped",
    margin: { left: PAGE.l, right: PAGE.r },
    columnStyles: {
      0: { cellWidth: 360 },
      1: { cellWidth: 80, halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const pageNum = tocResolved[data.row.index][1];
        if (typeof pageNum === "number") {
          pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
            pageNumber: pageNum,
          });
        }
      }
    },
  });

  const fileName = `EcoTrack_ESG_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
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



