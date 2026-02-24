// src/pages/SuggestionsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import TopNav from "../components/TopNav";

import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { getTailoredSuggestions } from "../utils/suggestionEngine";
import { getQuestionsForSector } from "../utils/questions";
import { SUGGESTIONS } from "../utils/suggestions"; // fallback pool
import "../components/landing.css";
import ecoTrackLogo from "../assets/ecotrack-logo.png";

import NewAssessmentButton from "../components/NewAssessmentButton";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- UI helpers ---------- */
function Card({ children, style }) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 6px 20px rgba(16,24,40,.06)",
        background: "#ffffff",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ children }) {
  return (
    <span
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        padding: "2px 6px",
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        color: "#475569",
      }}
    >
      {children}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/* ---------- normalization helpers ---------- */
function normalizeImpact(raw) {
  if (!raw) return "Medium";
  const v = String(raw).toLowerCase();
  if (v.includes("high")) return "High";
  if (v.includes("low")) return "Low";
  return "Medium";
}

function normalizeEffort(raw) {
  if (!raw) return "Medium";
  const v = String(raw).toLowerCase();
  if (v.startsWith("low")) return "Low";
  if (v.startsWith("high")) return "High";
  return "Medium";
}

function normalizeTimeframe(raw) {
  if (!raw) return "0–6 months";
  const v = String(raw).toLowerCase();
  if (v.includes("quick")) return "Quick win";
  if (v.includes("0-6") || v.includes("0–6")) return "0–6 months";
  if (v.includes("6-12") || v.includes("6–12")) return "6–12 months";
  if (v.includes("12+")) return "12+ months";
  if (v.includes("12")) return "12+ months";
  return raw;
}

function pillarLabel(p) {
  const x = String(p || "").toUpperCase();
  if (x === "E") return "Environmental";
  if (x === "S") return "Social";
  if (x === "G") return "Governance";
  return "—";
}

function sectorKey(v) {
  return String(v || "").trim().toLowerCase();
}

/* ---------- keep numeric answers when possible ---------- */
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

/* ---------- main ---------- */
export default function SuggestionsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [userName, setUserName] = useState("");
  const [sector, setSector] = useState("");
  const [source, setSource] = useState("none"); // "assessment" | "profile" | "none"

  const [profile, setProfile] = useState({
    size: "",
    country: "",
    turnover: "",
    csrd: "",
    goal: "",
    timeline: "",
  });

  const [latestAnswers, setLatestAnswers] = useState({});
  const [assessmentMeta, setAssessmentMeta] = useState(null);

  const [suggestions, setSuggestions] = useState([]);

  // Action plan
  const [actionPlan, setActionPlan] = useState([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState("");

  // breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 900);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Filters / search / sort
  const [filterPillar, setFilterPillar] = useState("");
  const [filterImpact, setFilterImpact] = useState("");
  const [filterEffort, setFilterEffort] = useState("");
  const [filterTimeframe, setFilterTimeframe] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recommend");

  /* ---------- load profile + assessments ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      const u = auth.currentUser;
      if (!u) {
        navigate("/login");
        return;
      }

      if (!alive) return;
      setUserId(u.uid);

      const userSnap = await getDoc(doc(db, "users", u.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const name =
        userData.name ||
        userData.profile?.name ||
        (u.email?.split("@")[0] ?? "");

      const profileDoc = userData.profile || {};
      const profileSector = profileDoc.sector || "";

      setProfile({
        size: profileDoc.size || "",
        country: profileDoc.country || "",
        turnover: profileDoc.turnover || "",
        csrd:
          profileDoc.csrd ||
          profileDoc.csrdInScope ||
          profileDoc.csrdScope ||
          profileDoc.csrdStatus ||
          "",
        goal: profileDoc.goal || profileDoc.primaryGoal || "",
        timeline: profileDoc.timeline || "",
      });

      // Load last 5 assessments
      const col = collection(db, "users", u.uid, "assessments");
      const qy = query(col, orderBy("createdAt", "desc"), limit(5));
      const snaps = await getDocs(qy);
      const docs = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));

      const chosen =
        docs.find((d) => d.status === "submitted") || docs[0] || null;

      const to100 = (v) => {
        if (typeof v !== "number" || Number.isNaN(v)) return null;
        if (v >= 0 && v <= 1) return Math.round(v * 100);
        return Math.round(v);
      };

      const fromLegacyPillars = (d) => {
        const ps = d?.pillarScores;
        if (!ps || typeof ps !== "object")
          return { env: null, soc: null, gov: null };
        return {
          env: to100(ps.E),
          soc: to100(ps.S),
          gov: to100(ps.G),
        };
      };

      if (chosen) {
        const chosenSector = chosen.sector || profileSector || "";

        const overall = to100(chosen.overallScore);
        const env = to100(chosen.envScore);
        const soc = to100(chosen.socScore);
        const gov = to100(chosen.govScore);

        const legacyOverall = overall ?? to100(chosen.overall);
        const legacyPillars = fromLegacyPillars(chosen);

        const finalOverall = overall ?? legacyOverall ?? null;
        const finalEnv = env ?? legacyPillars.env ?? null;
        const finalSoc = soc ?? legacyPillars.soc ?? null;
        const finalGov = gov ?? legacyPillars.gov ?? null;

        if (!alive) return;

        setSector(chosenSector);
        setLatestAnswers(chosen.answers || {});
        setSource("assessment");

        setAssessmentMeta({
          id: chosen.id,
          createdAt: chosen.createdAt || null,
          status: chosen.status || "draft",
          overall: finalOverall,
          env: finalEnv,
          soc: finalSoc,
          gov: finalGov,
        });
      } else {
        if (!alive) return;

        setSector(profileSector || "");
        setLatestAnswers({});
        setSource(profileSector ? "profile" : "none");
        setAssessmentMeta(null);
      }

      if (!alive) return;
      setUserName(name);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  /* ---------- load action plan ---------- */
  useEffect(() => {
    (async () => {
      if (!userId) return;
      setPlanLoading(true);
      setPlanError("");
      try {
        const colRef = collection(db, "users", userId, "actionPlan");
        const qy = query(colRef, orderBy("createdAt", "asc"));
        const snaps = await getDocs(qy);
        const items = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
        setActionPlan(items);
      } catch (e) {
        console.error("Error loading action plan", e);
        setPlanError(e.message || "Failed to load action plan.");
      } finally {
        setPlanLoading(false);
      }
    })();
  }, [userId]);

  /* ---------- pillar selection: below 50%, else lowest 2 ---------- */
  const PILLAR_THRESHOLD = 50;
  const LOWEST_PILLARS_FALLBACK = 2;

  const pillarPercents = useMemo(() => {
    if (!assessmentMeta) return null;

    const toPct = (v) => {
      if (typeof v !== "number" || Number.isNaN(v)) return null;
      if (v >= 0 && v <= 1) return Math.round(v * 100);
      return Math.round(v);
    };

    return {
      E: toPct(assessmentMeta.env),
      S: toPct(assessmentMeta.soc),
      G: toPct(assessmentMeta.gov),
    };
  }, [assessmentMeta]);

  const selectedPillarsInfo = useMemo(() => {
    if (!pillarPercents) return { pillars: [], mode: "none" };

    const entries = [
      ["E", pillarPercents.E],
      ["S", pillarPercents.S],
      ["G", pillarPercents.G],
    ].filter(([, v]) => typeof v === "number");

    const below = entries.filter(([, v]) => v < PILLAR_THRESHOLD).map(([p]) => p);
    if (below.length) return { pillars: below, mode: "threshold" };

    // none below threshold => lowest 2
    entries.sort((a, b) => a[1] - b[1]);
    const lowest = entries.slice(0, Math.max(1, LOWEST_PILLARS_FALLBACK)).map(([p]) => p);
    return { pillars: lowest, mode: "lowest" };
  }, [pillarPercents]);

  const selectedPillars = selectedPillarsInfo.pillars;

  /* ---------- build suggestions ---------- */
  const answersForEngine = useMemo(
    () => adaptAnswersForSuggestionEngine(latestAnswers),
    [latestAnswers]
  );

  useEffect(() => {
    if (loading) return;

    const sec = String(sector || "").trim();
    const qs = getQuestionsForSector(sec) || [];

    let list = getTailoredSuggestions({
      sector: sec,
      questions: qs,
      answers: answersForEngine,
      profile,
      limit: 40,
      pillarPercents,
      pillarThreshold: PILLAR_THRESHOLD,
      fallbackLowestNPillars: LOWEST_PILLARS_FALLBACK,
    });

    // Fallback if engine returns nothing
    if (!Array.isArray(list) || list.length === 0) {
      const wanted = sectorKey(sec);
      list = (Array.isArray(SUGGESTIONS) ? SUGGESTIONS : []).filter((s) => {
        const secs = (s.sectors || []).map((x) => String(x || "").trim().toLowerCase());
        return secs.includes("*") || secs.includes("all") || secs.includes(wanted);
      });
    }

    const enriched = (list || []).map((s, idx) => {
      const p = (s.pillar || "").toUpperCase();
      const pct = pillarPercents?.[p];

      let why = "";
      if (selectedPillars.includes(p)) {
        if (selectedPillarsInfo.mode === "threshold") {
          why = pct != null
            ? `${pillarLabel(p)} is below ${PILLAR_THRESHOLD}% (${pct}%).`
            : `${pillarLabel(p)} is below ${PILLAR_THRESHOLD}%.`;
        } else if (selectedPillarsInfo.mode === "lowest") {
          why = pct != null
            ? `${pillarLabel(p)} is among your lowest pillars (${pct}%).`
            : `${pillarLabel(p)} is among your lowest pillars.`;
        }
      }

      return {
        ...s,
        id: s.id || `suggestion-${idx}`,
        pillar: p,
        impact: normalizeImpact(s.impact),
        effort: normalizeEffort(s.effort),
        timeframe: normalizeTimeframe(s.timeframe),
        _why: why,
      };
    });

    setSuggestions(enriched);
  }, [
    loading,
    sector,
    answersForEngine,
    profile,
    pillarPercents,
    selectedPillars,
    selectedPillarsInfo.mode,
  ]);

  /* ---------- derived ---------- */
  const sourceHint =
    source === "assessment"
      ? "Based on your latest ESG assessment + onboarding profile"
      : source === "profile"
      ? "Based on your onboarding profile (no assessment answers found)"
      : "No assessment/profile found — showing generic actions";

  const hasSuggestions = suggestions && suggestions.length > 0;

  /* ---------- filters/search/sort ---------- */
  const filteredAndSortedSuggestions = useMemo(() => {
    let list = [...suggestions];

    if (filterPillar) list = list.filter((s) => (s.pillar || "") === filterPillar);

    if (filterImpact) {
      list = list.filter(
        (s) => (s.impact || "").toLowerCase() === filterImpact.toLowerCase()
      );
    }
    if (filterEffort) {
      list = list.filter(
        (s) => (s.effort || "").toLowerCase() === filterEffort.toLowerCase()
      );
    }
    if (filterTimeframe) {
      const key = filterTimeframe.toLowerCase();
      list = list.filter((s) => {
        const tf = (s.timeframe || "").toLowerCase();
        if (key === "quick") return tf.includes("quick") || tf.includes("0–6") || tf.includes("0-6");
        if (key === "0–6" || key === "0-6") return tf.includes("0–6") || tf.includes("0-6");
        if (key === "6–12" || key === "6-12") return tf.includes("6–12") || tf.includes("6-12");
        if (key === "12") return tf.includes("12");
        return true;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => {
        const text = (s.text || "").toLowerCase();
        const title = (s.title || "").toLowerCase();
        const tags = (s.tags || []).join(" ").toLowerCase();
        return text.includes(q) || title.includes(q) || tags.includes(q);
      });
    }

    const impactRank = (impact) =>
      impact === "High" ? 3 : impact === "Medium" ? 2 : impact === "Low" ? 1 : 0;
    const effortRank = (effort) =>
      effort === "Low" ? 3 : effort === "Medium" ? 2 : effort === "High" ? 1 : 0;

    list.sort((a, b) => {
      if (sortBy === "impact") return impactRank(b.impact) - impactRank(a.impact);
      if (sortBy === "effort") return effortRank(b.effort) - effortRank(a.effort);
      if (sortBy === "az") {
        const ta = (a.title || a.text || "").toLowerCase();
        const tb = (b.title || b.text || "").toLowerCase();
        return ta.localeCompare(tb);
      }
      // recommend: prioritize selected pillars via _why, then impact/effort
      const wa = a._why ? 1 : 0;
      const wb = b._why ? 1 : 0;
      if (wb !== wa) return wb - wa;
      return (
        impactRank(b.impact) * 10 +
        effortRank(b.effort) -
        (impactRank(a.impact) * 10 + effortRank(a.effort))
      );
    });

    return list;
  }, [
    suggestions,
    filterPillar,
    filterImpact,
    filterEffort,
    filterTimeframe,
    search,
    sortBy,
  ]);

  /* ---------- action plan helpers ---------- */
  const isInPlan = (suggestion) =>
    actionPlan.some((item) => item.suggestionId === suggestion.id);

  const handleAddToPlan = async (suggestion) => {
    if (!userId) return;
    if (isInPlan(suggestion)) return;

    setPlanError("");

    const text = suggestion.text || "Action item";

    const payload = {
      suggestionId: suggestion.id,
      text,
      tags: suggestion.tags || [],
      impact: normalizeImpact(suggestion.impact),
      effort: normalizeEffort(suggestion.effort),
      timeframe: normalizeTimeframe(suggestion.timeframe),
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const colRef = collection(db, "users", userId, "actionPlan");
      const docRef = await addDoc(colRef, payload);

      setActionPlan((prev) => [
        ...prev,
        { id: docRef.id, ...payload, createdAt: new Date(), updatedAt: new Date() },
      ]);
    } catch (e) {
      console.error("Error adding to action plan", e);
      setPlanError(e.message || "Failed to add action to plan.");
    }
  };

  const handleToggleCompleted = async (item) => {
    if (!userId) return;
    const newCompleted = !item.completed;
    setPlanError("");

    try {
      await updateDoc(doc(db, "users", userId, "actionPlan", item.id), {
        completed: newCompleted,
        updatedAt: serverTimestamp(),
      });
      setActionPlan((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, completed: newCompleted, updatedAt: new Date() } : p
        )
      );
    } catch (e) {
      console.error("Error updating action plan item", e);
      setPlanError(e.message || "Failed to update action plan.");
    }
  };

  const handleRemoveFromPlan = async (item) => {
    if (!userId) return;
    setPlanError("");

    try {
      await deleteDoc(doc(db, "users", userId, "actionPlan", item.id));
      setActionPlan((prev) => prev.filter((p) => p.id !== item.id));
    } catch (e) {
      console.error("Error removing action plan item", e);
      setPlanError(e.message || "Failed to remove action from plan.");
    }
  };

  /* ---------- Export Action Plan PDF (kept as-is) ---------- */
  const handleExportPlanPDF = async () => {
    if (!actionPlan.length) return;

    const BRAND = {
      green: [20, 138, 88],
      dark: [15, 23, 42],
      muted: [100, 116, 139],
      line: [226, 232, 240],
      bg: [248, 250, 252],
    };

    const safeText = (v) => (v == null ? "" : String(v));

    const fetchAsDataURL = async (url) => {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const completion = (() => {
      const total = actionPlan.length;
      const done = actionPlan.filter((i) => i.completed).length;
      const open = total - done;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return { total, done, open, pct };
    })();

    const openItems = actionPlan.filter((i) => !i.completed);

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const PAGE = {
      w: pdf.internal.pageSize.getWidth(),
      h: pdf.internal.pageSize.getHeight(),
      l: 56,
      r: 56,
      t: 56,
      b: 46,
    };

    let logoDataUrl = null;
    try {
      logoDataUrl = await fetchAsDataURL(ecoTrackLogo);
    } catch {
      logoDataUrl = null;
    }

    const drawHeader = () => {
      pdf.setFillColor(...BRAND.green);
      pdf.rect(0, 0, PAGE.w, 64, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text("EcoTrack — ESG Action Plan", PAGE.l, 40);

      if (logoDataUrl) {
        try {
          const props = pdf.getImageProperties(logoDataUrl);
          const logoH = 28;
          const logoW = (props.width / props.height) * logoH;
          const x = PAGE.w - PAGE.r - logoW;
          const y = 18;
          pdf.addImage(logoDataUrl, "PNG", x, y, logoW, logoH, undefined, "FAST");
        } catch {}
      }

      const cardY = 78;
      const cardH = 86;

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...BRAND.line);
      pdf.roundedRect(PAGE.l, cardY, PAGE.w - PAGE.l - PAGE.r, cardH, 10, 10, "FD");

      pdf.setTextColor(...BRAND.dark);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Organization: ${safeText(userName || "-")}`, PAGE.l + 14, cardY + 24);
      pdf.text(`Sector: ${safeText(sector || "-")}`, PAGE.l + 14, cardY + 42);
      pdf.setTextColor(...BRAND.muted);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, PAGE.l + 14, cardY + 60);

      const rightX = PAGE.w - PAGE.r - 220;
      pdf.setTextColor(...BRAND.dark);
      pdf.setFont("helvetica", "bold");
      pdf.text("Summary", rightX, cardY + 24);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...BRAND.muted);
      pdf.text(`Total: ${completion.total}`, rightX, cardY + 42);
      pdf.text(`Done: ${completion.done}`, rightX + 80, cardY + 42);
      pdf.text(`Open: ${completion.open}`, rightX + 150, cardY + 42);
    };

    drawHeader();

    autoTable(pdf, {
      startY: 180,
      head: [["#", "Action", "Impact", "Effort", "Timeframe"]],
      body: openItems.length
        ? openItems.map((it, idx) => [
            idx + 1,
            safeText(it.text),
            safeText(it.impact),
            safeText(it.effort),
            safeText(it.timeframe),
          ])
        : [["—", "No open actions.", "—", "—", "—"]],
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: BRAND.green, textColor: 255, fontStyle: "bold" },
    });

    pdf.save(`EcoTrack_ActionPlan_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <div className="landing" style={{ alignItems: "stretch" }}>
        <TopNav />
        <main className="landing__main" style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#64748b" }}>
              <span
                className="spinner"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid #e2e8f0",
                  borderTopColor: "#148A58",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Loading your suggestions…
            </div>
          </Card>
        </main>
      </div>
    );
  }

  /* ---------- render: action plan ---------- */
  const completedCount = actionPlan.filter((i) => i.completed).length;
  const completionRatio = actionPlan.length ? completedCount / actionPlan.length : 0;

  const renderActionPlanCard = () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Your Action Plan</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Add actions from suggestions, then track progress here.
          </div>
        </div>

        <Badge>
          {completedCount}/{actionPlan.length || 0} done
        </Badge>
      </div>

      <div style={{ width: "100%", height: 6, borderRadius: 999, background: "#e2e8f0", marginBottom: 8 }}>
        <div
          style={{
            width: `${completionRatio * 100}%`,
            height: "100%",
            borderRadius: 999,
            background: "#148A58",
            transition: "width 0.2s ease-out",
          }}
        />
      </div>

      {planError && <div style={{ marginBottom: 8, fontSize: 12, color: "#b91c1c" }}>{planError}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {actionPlan.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: 12, padding: "4px 8px", marginLeft: "auto" }}
            onClick={handleExportPlanPDF}
          >
            📄 Export plan PDF
          </button>
        )}
      </div>

      {planLoading ? (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Loading your plan…</div>
      ) : actionPlan.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>
          You haven’t added any actions yet. Use <strong>“Add to action plan”</strong> on the suggestions.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {actionPlan.map((item) => (
            <div
              key={item.id}
              style={{
                borderRadius: 12,
                padding: 8,
                border: "1px solid #e2e8f0",
                background: item.completed ? "#ecfdf3" : "#f8fafc",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <button
                type="button"
                onClick={() => handleToggleCompleted(item)}
                style={{
                  marginTop: 4,
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: "1px solid #cbd5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  background: item.completed ? "#148A58" : "#ffffff",
                  color: item.completed ? "#ffffff" : "transparent",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ✓
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", textDecoration: item.completed ? "line-through" : "none" }}>
                  {item.text}
                </div>
                <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11, color: "#64748b" }}>
                  {item.impact && <Badge>{item.impact}</Badge>}
                  {item.effort && <Badge>Effort: {item.effort}</Badge>}
                  {item.timeframe && <Badge>{item.timeframe}</Badge>}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveFromPlan(item)}
                style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  /* ---------- render: suggestions ---------- */
  const renderSuggestionsColumn = () => (
    <div style={{ display: "grid", gap: 12 }}>
      {hasSuggestions ? (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {filteredAndSortedSuggestions.map((s) => (
            <Card key={s.id}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#0f172a" }}>
                {s.title || "Suggested action"}
              </div>

              <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.4 }}>{s.text}</div>

              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, color: "#64748b" }}>
                {s.pillar && <Badge>{s.pillar}</Badge>}
                <Badge>Impact: {normalizeImpact(s.impact)}</Badge>
                <Badge>Effort: {normalizeEffort(s.effort)}</Badge>
                <Badge>{normalizeTimeframe(s.timeframe)}</Badge>
              </div>

              {!!s.tags?.length && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {s.tags.slice(0, 8).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 12,
                        color: "#334155",
                        background: "#f1f5f9",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {!!s._why && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", borderTop: "1px dashed #e2e8f0", paddingTop: 6 }}>
                  <strong>Why this?</strong> {s._why}
                </div>
              )}

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                {isInPlan(s) ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 13, padding: "4px 10px" }}
                    onClick={() => {
                      const existing = actionPlan.find((i) => i.suggestionId === s.id);
                      if (existing) handleRemoveFromPlan(existing);
                    }}
                  >
                    Remove from plan
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ fontSize: 13, padding: "4px 10px" }}
                    onClick={() => handleAddToPlan(s)}
                  >
                    Add to action plan
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div style={{ fontSize: 14, color: "#64748b", display: "flex", flexDirection: "column", gap: 8 }}>
            <span>No suggestions available yet. Run an assessment to unlock tailored actions.</span>
            <div>
              <NewAssessmentButton label="Start your first assessment" className="btn btn--primary" sector={sector} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  /* ---------- layout ---------- */
  return (
    <div className="landing" style={{ alignItems: "stretch" }}>
      <TopNav />

      <main className="landing__main" style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 className="landing__title" style={{ marginBottom: 4 }}>
                Suggestions
              </h1>
              <div className="landing__subtitle" style={{ opacity: 0.9, fontSize: 14 }}>
                If any pillar is below {PILLAR_THRESHOLD}%, we target it. Otherwise we target your {LOWEST_PILLARS_FALLBACK} lowest pillars.
              </div>
            </div>

            <div className="landing__subtitle" style={{ opacity: 0.8, fontSize: 14 }}>
              Welcome, {userName} • Sector: {sector || "—"}
            </div>
          </div>

          <Card>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, color: "#64748b" }}>{sourceHint}</span>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge>Goal: {profile.goal || "—"}</Badge>
                  <Badge>CSRD: {profile.csrd || "—"}</Badge>
                  <Badge>Size: {profile.size || "—"}</Badge>
                  <Badge>Turnover: {profile.turnover || "—"}</Badge>
                  <Badge>Timeline: {profile.timeline || "—"}</Badge>
                </div>

                {assessmentMeta ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                    <Badge>Latest assessment</Badge>
                    <span>
                      {formatDate(assessmentMeta.createdAt)} • Status: {assessmentMeta.status}
                    </span>
                    {assessmentMeta.overall != null && (
                      <>
                        <span>• Overall: {assessmentMeta.overall}%</span>
                        {assessmentMeta.env != null && <span>· E: {assessmentMeta.env}%</span>}
                        {assessmentMeta.soc != null && <span>· S: {assessmentMeta.soc}%</span>}
                        {assessmentMeta.gov != null && <span>· G: {assessmentMeta.gov}%</span>}
                      </>
                    )}
                    {!!selectedPillars.length && (
                      <span>
                        • Targeting: {selectedPillars.join(", ")} ({selectedPillarsInfo.mode === "threshold" ? `below ${PILLAR_THRESHOLD}%` : `lowest ${LOWEST_PILLARS_FALLBACK}`})
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Complete an assessment to unlock fully tailored suggestions.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <NewAssessmentButton label="Improve score" className="btn btn--primary" sector={sector} />
              </div>
            </div>
          </Card>

          {/* Filters */}
          <Card>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search suggestions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: "1 1 200px",
                  minWidth: 160,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />

              <select value={filterPillar} onChange={(e) => setFilterPillar(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <option value="">All pillars</option>
                <option value="E">Environmental</option>
                <option value="S">Social</option>
                <option value="G">Governance</option>
              </select>

              <select value={filterImpact} onChange={(e) => setFilterImpact(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <option value="">Any impact</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select value={filterEffort} onChange={(e) => setFilterEffort(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <option value="">Any effort</option>
                <option value="Low">Low effort</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <select value={filterTimeframe} onChange={(e) => setFilterTimeframe(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <option value="">Any timeframe</option>
                <option value="0–6">0–6 months</option>
                <option value="6–12">6–12 months</option>
                <option value="12">12+ months</option>
                <option value="quick">Quick wins</option>
              </select>

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <option value="recommend">Recommended</option>
                <option value="impact">High impact first</option>
                <option value="effort">Low effort first</option>
                <option value="az">A → Z</option>
              </select>
            </div>
          </Card>

          {/* Layout */}
          {isMobile ? (
            <div style={{ display: "grid", gap: 16 }}>
              {renderActionPlanCard()}
              {renderSuggestionsColumn()}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.1fr)", gap: 16 }}>
              {renderSuggestionsColumn()}
              <div style={{ position: "sticky", top: 88, alignSelf: "flex-start" }}>{renderActionPlanCard()}</div>
            </div>
          )}
        </div>
      </main>

      <style>
        {`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (max-width: 900px) { .landing__main { padding: 72px 16px 24px; } }
        `}
      </style>
    </div>
  );
}












