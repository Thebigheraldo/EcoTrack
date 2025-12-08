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
} from "firebase/firestore";

import { getTailoredSuggestions } from "../utils/suggestionEngine";
import { getQuestionsForSector } from "../utils/questions";
import "../components/landing.css";

// Unified button for starting a new assessment
import NewAssessmentButton from "../components/NewAssessmentButton";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- Small UI helpers ---------- */

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

function formatDateISO(d) {
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

/* ---------- Normalization helpers ---------- */

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
  if (v.includes("12")) return "12+ months";
  return raw;
}

const TAG_PILLAR_MAP = {
  // Environmental
  energy: "E",
  "energy-efficiency": "E",
  lighting: "E",
  metering: "E",
  scope2: "E",
  scope3: "E",
  carbon: "E",
  emissions: "E",
  climate: "E",
  water: "E",
  waste: "E",
  circularity: "E",
  recycling: "E",
  logistics: "E",
  transport: "E",
  chemicals: "E",
  biodiversity: "E",
  // Social
  people: "S",
  "health-safety": "S",
  safety: "S",
  training: "S",
  hr: "S",
  "human-rights": "S",
  diversity: "S",
  inclusion: "S",
  labor: "S",
  community: "S",
  wellbeing: "S",
  // Governance
  governance: "G",
  board: "G",
  policy: "G",
  ethics: "G",
  anticorruption: "G",
  "anti-bribery": "G",
  bribery: "G",
  procurement: "G",
  transparency: "G",
  reporting: "G",
  csrd: "G",
  esrs: "G",
  compliance: "G",
};

/* ---------- Compliance helpers ---------- */

const COMPLIANCE_TAGS = [
  "governance",
  "policy",
  "ethics",
  "compliance",
  "reporting",
  "csrd",
  "esrs",
  "audit",
  "anti-bribery",
  "anticorruption",
  "transparency",
];

function isComplianceSuggestion(s) {
  const tags = (s.tags || []).map((t) => String(t).toLowerCase());
  const hasComplianceTag = tags.some((t) => COMPLIANCE_TAGS.includes(t));
  const isGovPillar = (s.pillar || "").toUpperCase() === "G";
  return hasComplianceTag || isGovPillar;
}

function inferPillarFromSuggestion(s) {
  if (s.pillar) return String(s.pillar).toUpperCase();
  if (s.esg) return String(s.esg).toUpperCase();

  const tags = (s.tags || []).map((t) => String(t).toLowerCase());
  for (const tag of tags) {
    const clean = tag.replace(/[^a-z0-9-]/g, "");
    if (TAG_PILLAR_MAP[clean]) {
      return TAG_PILLAR_MAP[clean];
    }
  }
  return undefined;
}

/**
 * Infer impact/effort/timeframe heuristically from tags
 * so filters + quick wins actually have something to work with.
 */
function inferMetaFromTags(baseImpact, baseEffort, baseTimeframe, rawTags) {
  const tags = (rawTags || []).map((t) => String(t).toLowerCase());
  let impact = normalizeImpact(baseImpact);
  let effort = normalizeEffort(baseEffort);
  let timeframe = normalizeTimeframe(baseTimeframe);

  const hasTag = (key) =>
    tags.some((t) => t === key || t.includes(key) || key.includes(t));

  // ---- Impact ----
  if (!baseImpact) {
    if (
      hasTag("policy") ||
      hasTag("governance") ||
      hasTag("ethics") ||
      hasTag("transparency") ||
      hasTag("reporting") ||
      hasTag("metrics") ||
      hasTag("foundations") ||
      hasTag("csrd") ||
      hasTag("esrs")
    ) {
      impact = "High";
    } else if (
      hasTag("energy") ||
      hasTag("energy-efficiency") ||
      hasTag("lighting") ||
      hasTag("waste") ||
      hasTag("water") ||
      hasTag("recycling") ||
      hasTag("scope2") ||
      hasTag("scope3") ||
      hasTag("carbon") ||
      hasTag("emissions")
    ) {
      impact = "High";
    } else {
      impact = "Medium";
    }
  }

  // ---- Effort ----
  if (!baseEffort) {
    if (
      hasTag("policy") ||
      hasTag("governance") ||
      hasTag("ethics") ||
      hasTag("reporting") ||
      hasTag("metrics") ||
      hasTag("training") ||
      hasTag("code-of-conduct")
    ) {
      effort = "Low";
    } else if (
      hasTag("logistics") ||
      hasTag("transport") ||
      hasTag("scope3") ||
      hasTag("infrastructure") ||
      hasTag("retrofit") ||
      hasTag("capex")
    ) {
      effort = "High";
    } else {
      effort = "Medium";
    }
  }

  // ---- Timeframe ----
  if (!baseTimeframe) {
    if (effort === "Low") {
      timeframe = "0–6 months";
    } else if (effort === "Medium") {
      timeframe = "6–12 months";
    } else {
      timeframe = "12+ months";
    }
  }

  return { impact, effort, timeframe };
}

/* ---------- Main page ---------- */

export default function SuggestionsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [sector, setSector] = useState("");
  const [source, setSource] = useState("none"); // "assessment" | "profile" | "none"

  const [latestAnswers, setLatestAnswers] = useState({});
  const [assessmentMeta, setAssessmentMeta] = useState(null); // {id, createdAt, status, overall, env, soc, gov}

  const [suggestions, setSuggestions] = useState([]);

  const [actionPlan, setActionPlan] = useState([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState("");

  const [userId, setUserId] = useState(null);

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

  /* ---------- Load profile + assessments ---------- */

  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) {
        navigate("/login");
        return;
      }
      setUserId(u.uid);

      const userSnap = await getDoc(doc(db, "users", u.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const name =
        userData.name ||
        userData.profile?.name ||
        (u.email?.split("@")[0] ?? "");
      const profileSector = userData.profile?.sector || "";

      const col = collection(db, "users", u.uid, "assessments");
      const qy = query(col, orderBy("createdAt", "desc"), limit(5));
      const snaps = await getDocs(qy);
      const docs = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));

      const chosen =
        docs.find((d) => d.status === "submitted") || docs[0] || null;

      if (chosen) {
        const chosenSector = chosen.sector || profileSector || "";
        setSector(chosenSector);
        setLatestAnswers(chosen.answers || {});
        setSource("assessment");
        setAssessmentMeta({
          id: chosen.id,
          createdAt: chosen.createdAt || null,
          status: chosen.status || "draft",
          overall: chosen.overallScore ?? null,
          env: chosen.envScore ?? null,
          soc: chosen.socScore ?? null,
          gov: chosen.govScore ?? null,
        });
      } else {
        setSector(profileSector || "");
        setLatestAnswers({});
        setSource(profileSector ? "profile" : "none");
        setAssessmentMeta(null);
      }

      setUserName(name);
      setLoading(false);
    })();
  }, [navigate]);

  /* ---------- Load existing action plan ---------- */

  useEffect(() => {
    (async () => {
      if (!userId) return;
      setPlanLoading(true);
      setPlanError("");
      try {
        const col = collection(db, "users", userId, "actionPlan");
        const qy = query(col, orderBy("createdAt", "asc"));
        const snaps = await getDocs(qy);
        const items = snaps.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setActionPlan(items);
      } catch (e) {
        console.error("Error loading action plan", e);
        setPlanError(e.message || "Failed to load action plan.");
      } finally {
        setPlanLoading(false);
      }
    })();
  }, [userId]);

  /* ---------- Build suggestions (sector + answers) ---------- */

  useEffect(() => {
    if (loading) return;

    const qs = getQuestionsForSector(sector);
    const list = getTailoredSuggestions({
      sector,
      questions: qs,
      answers: latestAnswers,
      limit: 20,
    });

    const enriched = list.map((s, idx) => {
      const pillar = inferPillarFromSuggestion(s);

      // Heuristic meta from tags if not explicitly set
      const { impact, effort, timeframe } = inferMetaFromTags(
        s.impact,
        s.effort,
        s.timeframe,
        s.tags
      );

      return {
        ...s,
        pillar,
        impact,
        effort,
        timeframe,
        id: s.id || `suggestion-${idx}`,
      };
    });

    setSuggestions(enriched);
  }, [sector, latestAnswers, loading]);

  /* ---------- Derived values ---------- */

  const sourceHint =
    source === "assessment"
      ? "Based on your latest ESG assessment"
      : source === "profile"
      ? "Based on your profile sector"
      : "No assessment/profile found — showing generic actions";

  const hasSuggestions = suggestions && suggestions.length > 0;

  const worstPillarKey = useMemo(() => {
    if (!assessmentMeta) return null;
    const { env, soc, gov } = assessmentMeta;
    const entries = [
      ["E", env],
      ["S", soc],
      ["G", gov],
    ].filter(([, v]) => typeof v === "number");
    if (!entries.length) return null;
    entries.sort((a, b) => a[1] - b[1]);
    return entries[0][0];
  }, [assessmentMeta]);

  const worstPillarLabel =
    worstPillarKey === "E"
      ? "Environmental"
      : worstPillarKey === "S"
      ? "Social"
      : worstPillarKey === "G"
      ? "Governance"
      : null;

  /* ---------- Filters, search, sort ---------- */

  const filteredAndSortedSuggestions = useMemo(() => {
    let list = [...suggestions];

    if (filterPillar) {
      list = list.filter(
        (s) => (s.pillar || "").toUpperCase() === filterPillar
      );
    }
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
        if (key === "quick") return tf.includes("quick");
        if (key === "0–6" || key === "0-6")
          return tf.includes("0–6") || tf.includes("0-6");
        if (key === "6–12" || key === "6-12")
          return tf.includes("6–12") || tf.includes("6-12");
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
      if (sortBy === "impact") {
        return impactRank(b.impact) - impactRank(a.impact);
      }
      if (sortBy === "effort") {
        return effortRank(b.effort) - effortRank(a.effort);
      }
      if (sortBy === "az") {
        const ta = (a.title || a.text || "").toLowerCase();
        const tb = (b.title || b.text || "").toLowerCase();
        return ta.localeCompare(tb);
      }
      const score = (s) => impactRank(s.impact) * 10 + effortRank(s.effort);
      return score(b) - score(a);
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

  /* ---------- Action plan helpers ---------- */

  const isInPlan = (suggestion) =>
    actionPlan.some((item) => item.suggestionId === suggestion.id);

  const handleAddToPlan = async (suggestion) => {
    if (!userId) return;
    if (isInPlan(suggestion)) return;

    setPlanError("");

    const text =
      suggestion.text ||
      (typeof suggestion === "string" ? suggestion : "Action item");

    const payload = {
      suggestionId: suggestion.id,
      text,
      tags: suggestion.tags || [],
      impact: normalizeImpact(suggestion.impact),
      effort: normalizeEffort(suggestion.effort),
      timeframe: normalizeTimeframe(suggestion.timeframe),
      completed: false,
      inSprint: false, // new flag, default false
      createdAt: new Date(),
    };

    try {
      const colRef = collection(db, "users", userId, "actionPlan");
      const docRef = await addDoc(colRef, payload);
      setActionPlan((prev) => [...prev, { id: docRef.id, ...payload }]);
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
      });
      setActionPlan((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, completed: newCompleted } : p
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

  /* ---------- One-click roadmaps ---------- */

  const quickWinsRoadmap = async () => {
    if (!suggestions.length || !userId) {
      setPlanError("No suggestions available for quick wins.");
      return;
    }
    setPlanError("");

    const impactRank = (impact) =>
      impact === "High" ? 3 : impact === "Medium" ? 2 : 1;

    // Prefer non-compliance suggestions (E/S focus) for quick wins
    let pool = suggestions.filter((s) => !isComplianceSuggestion(s));

    // Fallback: if everything is governance/compliance, use all suggestions
    if (!pool.length) {
      pool = [...suggestions];
    }

    // 1) prefer low-effort
    let quick = pool.filter(
      (s) => normalizeEffort(s.effort) === "Low"
    );

    // 2) fallback: medium effort + high impact
    if (!quick.length) {
      quick = pool.filter(
        (s) =>
          normalizeEffort(s.effort) === "Medium" &&
          normalizeImpact(s.impact) === "High"
      );
    }

    // 3) final fallback: top by impact from pool
    if (!quick.length) {
      quick = [...pool].sort(
        (a, b) =>
          impactRank(normalizeImpact(b.impact)) -
          impactRank(normalizeImpact(a.impact))
      );
    }

    quick = quick.slice(0, 5);
    if (!quick.length) {
      setPlanError("Couldn't find any suggestions suitable as quick wins.");
      return;
    }

    for (const s of quick) {
      if (!isInPlan(s)) {
        await handleAddToPlan(s);
      }
    }
  };

  const complianceRoadmap = async () => {
    if (!suggestions.length || !userId) {
      setPlanError("No suggestions available for compliance roadmap.");
      return;
    }
    setPlanError("");

    const impactRank = (impact) =>
      impact === "High" ? 3 : impact === "Medium" ? 2 : 1;

    // Focus on governance/compliance suggestions
    let compl = suggestions.filter((s) => isComplianceSuggestion(s));

    // Fallback: if nothing is tagged, use all G-pillar suggestions
    if (!compl.length) {
      compl = suggestions.filter(
        (s) => (s.pillar || "").toUpperCase() === "G"
      );
    }

    compl = compl
      .sort(
        (a, b) =>
          impactRank(normalizeImpact(b.impact)) -
          impactRank(normalizeImpact(a.impact))
      )
      .slice(0, 5);

    if (!compl.length) {
      setPlanError(
        "Couldn't find suggestions tagged as governance/compliance."
      );
      return;
    }

    for (const s of compl) {
      if (!isInPlan(s)) {
        await handleAddToPlan(s);
      }
    }
  };

  /* ---------- Scenario builder ---------- */

  const currentOverall = assessmentMeta?.overall ?? null;

  const estimatedImpact = useMemo(() => {
    if (!actionPlan.length) {
      return { overallDelta: 0, futureOverall: currentOverall ?? null };
    }

    const impactScore = (impact) =>
      impact === "High" ? 3 : impact === "Medium" ? 2 : 1;

    const totalImpact = actionPlan.reduce(
      (sum, item) =>
        sum + impactScore(normalizeImpact(item.impact || "Medium")),
      0
    );

    const delta = Math.min(20, Math.round(totalImpact * 1.5));
    const future =
      typeof currentOverall === "number"
        ? Math.min(100, currentOverall + delta)
        : null;

    return { overallDelta: delta, futureOverall: future };
  }, [actionPlan, currentOverall]);

  /* ---------- Export Action Plan PDF ---------- */

  const handleExportPlanPDF = () => {
    if (!actionPlan.length) return;

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const PAGE = {
      w: pdf.internal.pageSize.getWidth(),
      h: pdf.internal.pageSize.getHeight(),
      l: 56,
      r: 56,
      t: 64,
    };

    pdf.setFontSize(18);
    pdf.text("EcoTrack – ESG Action Plan", PAGE.l, PAGE.t);
    pdf.setFontSize(11);
    pdf.text(`Organization: ${userName || "-"}`, PAGE.l, PAGE.t + 20);
    pdf.text(`Sector: ${sector || "-"}`, PAGE.l, PAGE.t + 36);
    pdf.text(
      `Generated: ${new Date().toLocaleString()}`,
      PAGE.l,
      PAGE.t + 52
    );

    const rows = actionPlan.map((item, idx) => [
      idx + 1,
      item.text || "",
      normalizeImpact(item.impact),
      normalizeEffort(item.effort),
      normalizeTimeframe(item.timeframe),
      item.completed ? "Done" : "Planned",
    ]);

    autoTable(pdf, {
      startY: PAGE.t + 70,
      head: [["#", "Action", "Impact", "Effort", "Timeframe", "Status"]],
      body: rows.length ? rows : [["-", "-", "-", "-", "-", "-"]],
      styles: { fontSize: 10, cellPadding: 5, lineHeight: 1.2 },
      headStyles: { fillColor: [20, 138, 88], textColor: 255 },
      theme: "striped",
      margin: { left: PAGE.l, right: PAGE.r },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - 220 },
        2: { cellWidth: 60 },
        3: { cellWidth: 60 },
        4: { cellWidth: 80 },
        5: { cellWidth: 60 },
      },
    });

    const fileName = `EcoTrack_ActionPlan_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    pdf.save(fileName);
  };

  /* ---------- Action Sprint helpers ---------- */

  const handleStartSprint = async () => {
    if (!userId) return;
    setPlanError("");

    const openItems = actionPlan.filter((i) => !i.completed);

    if (!openItems.length) {
      setPlanError("You have no open actions to start a Sprint.");
      return;
    }

    const impactRank = (impact) => {
      const v = normalizeImpact(impact);
      return v === "High" ? 3 : v === "Medium" ? 2 : 1;
    };

    const effortRank = (effort) => {
      const v = normalizeEffort(effort);
      // low effort = higher priority
      return v === "Low" ? 3 : v === "Medium" ? 2 : 1;
    };

    const candidates = [...openItems].sort((a, b) => {
      const scoreA = impactRank(a.impact) * 10 + effortRank(a.effort);
      const scoreB = impactRank(b.impact) * 10 + effortRank(b.effort);
      return scoreB - scoreA;
    });

    const selected = candidates.slice(0, 5); // up to 5 actions
    if (!selected.length) {
      setPlanError("Could not assemble a Sprint from your current actions.");
      return;
    }

    const selectedIds = new Set(selected.map((i) => i.id));

    // Local state
    setActionPlan((prev) =>
      prev.map((item) => ({
        ...item,
        inSprint: selectedIds.has(item.id),
      }))
    );

    // Persist in Firestore
    try {
      const updates = actionPlan.map((item) => {
        const inSprint = selectedIds.has(item.id);
        const ref = doc(db, "users", userId, "actionPlan", item.id);
        return updateDoc(ref, { inSprint });
      });
      await Promise.all(updates);
    } catch (e) {
      console.error("Error starting Sprint", e);
      setPlanError(e.message || "Failed to start Action Sprint.");
    }
  };

  const handleClearSprint = async () => {
    if (!userId) return;
    setPlanError("");

    const sprintDocs = actionPlan.filter((i) => i.inSprint);
    if (!sprintDocs.length) return;

    setActionPlan((prev) =>
      prev.map((item) => ({
        ...item,
        inSprint: false,
      }))
    );

    try {
      const updates = sprintDocs.map((item) => {
        const ref = doc(db, "users", userId, "actionPlan", item.id);
        return updateDoc(ref, { inSprint: false });
      });
      await Promise.all(updates);
    } catch (e) {
      console.error("Error clearing Sprint", e);
      setPlanError(e.message || "Failed to clear Action Sprint.");
    }
  };

  /* ---------- Misc helpers ---------- */

  const completedCount = actionPlan.filter((i) => i.completed).length;
  const completionRatio =
    actionPlan.length > 0 ? completedCount / actionPlan.length : 0;

  const sprintItems = useMemo(
    () => actionPlan.filter((i) => i.inSprint),
    [actionPlan]
  );
  const sprintTotal = sprintItems.length;
  const sprintDone = sprintItems.filter((i) => i.completed).length;
  const sprintProgress =
    sprintTotal > 0 ? Math.round((sprintDone / sprintTotal) * 100) : 0;

  const getTargetDateForItem = (item) => {
    const base =
      item.createdAt && item.createdAt.toDate
        ? item.createdAt.toDate()
        : new Date();

    const tf = normalizeTimeframe(item.timeframe || "").toLowerCase();
    const d = new Date(base);

    if (tf.includes("quick") || tf.includes("0–6") || tf.includes("0-6")) {
      d.setMonth(d.getMonth() + 3);
    } else if (tf.includes("6–12") || tf.includes("6-12")) {
      d.setMonth(d.getMonth() + 9);
    } else {
      d.setMonth(d.getMonth() + 12);
    }
    return formatDateISO(d);
  };

  /* ---------- Loading state ---------- */

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
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "#64748b",
              }}
            >
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

  /* ---------- Render helpers ---------- */

  const renderActionPlanCard = () => (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            Your Action Plan
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginTop: 2,
            }}
          >
            Build your backlog and then focus on a short Action Sprint.
          </div>
        </div>

        <Badge>
          {completedCount}/{actionPlan.length || 0} done
        </Badge>
      </div>

      {/* Global Action Plan progress */}
      <div
        style={{
          width: "100%",
          height: 6,
          borderRadius: 999,
          background: "#e2e8f0",
          marginBottom: 8,
        }}
      >
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

      {/* Scenario */}
      {typeof currentOverall === "number" && (
        <div
          style={{
            marginBottom: 10,
            fontSize: 12,
            color: "#475569",
          }}
        >
          Scenario: if you implement all actions in this plan, your overall
          score could move from{" "}
          <strong>{currentOverall}%</strong> to{" "}
          <strong>
            {estimatedImpact.futureOverall ?? currentOverall}%
          </strong>{" "}
          (approx. +{estimatedImpact.overallDelta} pts).
        </div>
      )}

      {/* Errors */}
      {planError && (
        <div
          style={{
            marginBottom: 8,
            fontSize: 12,
            color: "#b91c1c",
          }}
        >
          {planError}
        </div>
      )}

      {/* 30-Day Action Sprint */}
      <div
        style={{
          marginBottom: 12,
          padding: 10,
          borderRadius: 12,
          border: "1px dashed #d1d5db",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              30-Day Action Sprint
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 2,
              }}
            >
              {sprintTotal > 0
                ? "Focus on a small set of priority actions for the next 30 days."
                : "Create a focused mini-plan with 3–5 actions from your Action Plan."}
            </div>
          </div>

          {sprintTotal > 0 && (
            <Badge>
              {sprintDone}/{sprintTotal} done
            </Badge>
          )}
        </div>

        {sprintTotal > 0 ? (
          <>
            {/* Sprint progress */}
            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 999,
                background: "#e5e7eb",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${sprintProgress}%`,
                  height: "100%",
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, #16A34A, #22C55E)",
                  transition: "width 0.2s ease-out",
                }}
              />
            </div>

            {/* Sprint items (compact list) */}
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {sprintItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#0f172a",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      border: "1px solid #cbd5f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      background: item.completed ? "#148A58" : "#ffffff",
                      color: item.completed ? "#ffffff" : "transparent",
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      textDecoration: item.completed
                        ? "line-through"
                        : "none",
                      color: item.completed ? "#9ca3af" : "#111827",
                    }}
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 12, padding: "4px 8px" }}
                onClick={handleClearSprint}
              >
                Reset Sprint
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              You don’t have an active Sprint yet.
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ fontSize: 12, padding: "4px 8px" }}
              onClick={handleStartSprint}
              disabled={
                actionPlan.filter((i) => !i.completed).length === 0
              }
            >
              Start 30-day Action Sprint
            </button>
          </div>
        )}
      </div>

      {/* Roadmap buttons + export */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 12, padding: "4px 8px" }}
          onClick={quickWinsRoadmap}
        >
          + Quick wins roadmap
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 12, padding: "4px 8px" }}
          onClick={complianceRoadmap}
        >
          + Compliance roadmap
        </button>
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

      {/* Action list */}
      {planLoading ? (
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          Loading your plan…
        </div>
      ) : actionPlan.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          You haven’t added any actions yet. Use{" "}
          <strong>“Add to action plan”</strong> on the suggestions to build your
          roadmap.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
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
                aria-label={
                  item.completed
                    ? "Mark as not completed"
                    : "Mark as completed"
                }
              >
                ✓
              </button>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0f172a",
                    textDecoration: item.completed ? "line-through" : "none",
                  }}
                >
                  {item.text}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  {item.impact && <Badge>{normalizeImpact(item.impact)}</Badge>}
                  {item.effort && (
                    <Badge>Effort: {normalizeEffort(item.effort)}</Badge>
                  )}
                  {item.timeframe && (
                    <Badge>{normalizeTimeframe(item.timeframe)}</Badge>
                  )}
                  <span>
                    Target date:{" "}
                    <strong>{getTargetDateForItem(item)}</strong>
                  </span>
                  {item.inSprint && (
                    <Badge>In Sprint</Badge>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveFromPlan(item)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  fontSize: 14,
                  cursor: "pointer",
                }}
                aria-label="Remove from plan"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const renderSuggestionsColumn = () => (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      {hasSuggestions ? (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {filteredAndSortedSuggestions.map((s) => {
            const reasonLines = [];

            if (s.pillar && worstPillarLabel && s.pillar === worstPillarKey) {
              reasonLines.push(
                `This action targets your most fragile pillar (${worstPillarLabel}).`
              );
            } else if (s.pillar) {
              const pLabel =
                s.pillar === "E"
                  ? "Environmental"
                  : s.pillar === "S"
                  ? "Social"
                  : s.pillar === "G"
                  ? "Governance"
                  : s.pillar;
              reasonLines.push(`This action strengthens the ${pLabel} pillar.`);
            }

            if (s.tags && s.tags.length) {
              reasonLines.push(
                `Focus area: ${s.tags.slice(0, 3).join(", ")}${
                  s.tags.length > 3 ? "…" : ""
                }`
              );
            }

            if (normalizeImpact(s.impact) === "High") {
              reasonLines.push("Estimated impact on your ESG maturity is high.");
            }

            const whyText = reasonLines.join(" ");

            return (
              <Card key={s.id}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#0f172a",
                  }}
                >
                  {s.title ||
                    (typeof s.text === "string"
                      ? s.text.split(".")[0]
                      : "Suggested action")}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: "#0f172a",
                    lineHeight: 1.4,
                  }}
                >
                  {s.text}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  {s.pillar && <Badge>{s.pillar}</Badge>}
                  <Badge>Impact: {normalizeImpact(s.impact)}</Badge>
                  <Badge>Effort: {normalizeEffort(s.effort)}</Badge>
                  <Badge>{normalizeTimeframe(s.timeframe)}</Badge>
                </div>

                {!!s.tags?.length && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {s.tags.map((t) => (
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

                {whyText && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#64748b",
                      borderTop: "1px dashed #e2e8f0",
                      paddingTop: 6,
                    }}
                  >
                    <strong>Why this?</strong> {whyText}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  {isInPlan(s) ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ fontSize: 13, padding: "4px 10px" }}
                      onClick={() => {
                        const existing = actionPlan.find(
                          (i) => i.suggestionId === s.id
                        );
                        if (existing) {
                          handleRemoveFromPlan(existing);
                        }
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
            );
          })}
        </div>
      ) : (
        <Card>
          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span>
              No suggestions available yet. Run an assessment to unlock tailored
              actions.
            </span>
            <div>
              <NewAssessmentButton
                label="Start your first assessment"
                className="btn btn--primary"
                sector={sector}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  /* ---------- Main layout ---------- */

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
        <div style={{ display: "grid", gap: 16 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 className="landing__title" style={{ marginBottom: 4 }}>
                Suggestions
              </h1>
              <div
                className="landing__subtitle"
                style={{ opacity: 0.9, fontSize: 14 }}
              >
                Turn your ESG assessment into a focused action plan and 30-day
                Sprint.
              </div>
            </div>

            <div
              className="landing__subtitle"
              style={{ opacity: 0.8, fontSize: 14 }}
            >
              Welcome, {userName} • Sector: {sector || "—"}
            </div>
          </div>

          {/* Context + CTA */}
          <Card>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 14, color: "#64748b" }}>
                  {sourceHint}
                </span>

                {assessmentMeta ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    <Badge>Latest assessment</Badge>
                    <span>
                      {formatDate(assessmentMeta.createdAt)} • Status:{" "}
                      {assessmentMeta.status}
                    </span>
                    {assessmentMeta.overall != null && (
                      <>
                        <span>• Overall: {assessmentMeta.overall}%</span>
                        {assessmentMeta.env != null && (
                          <span>· E: {assessmentMeta.env}%</span>
                        )}
                        {assessmentMeta.soc != null && (
                          <span>· S: {assessmentMeta.soc}%</span>
                        )}
                        {assessmentMeta.gov != null && (
                          <span>· G: {assessmentMeta.gov}%</span>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                    }}
                  >
                    Complete an assessment to unlock fully tailored suggestions.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <NewAssessmentButton
                  label="Improve score"
                  className="btn btn--primary"
                  sector={sector}
                />
              </div>
            </div>
          </Card>

          {/* Filters + search + sort */}
          <Card>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
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

              <select
                value={filterPillar}
                onChange={(e) => setFilterPillar(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <option value="">All pillars</option>
                <option value="E">Environmental</option>
                <option value="S">Social</option>
                <option value="G">Governance</option>
              </select>

              <select
                value={filterImpact}
                onChange={(e) => setFilterImpact(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <option value="">Any impact</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                value={filterEffort}
                onChange={(e) => setFilterEffort(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <option value="">Any effort</option>
                <option value="Low">Low effort</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <select
                value={filterTimeframe}
                onChange={(e) => setFilterTimeframe(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <option value="">Any timeframe</option>
                <option value="0–6">0–6 months</option>
                <option value="6–12">6–12 months</option>
                <option value="12">12+ months</option>
                <option value="quick">Quick wins</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <option value="recommend">Recommended</option>
                <option value="impact">High impact first</option>
                <option value="effort">Low effort first</option>
                <option value="az">A → Z</option>
              </select>
            </div>
          </Card>

          {/* Layout: mobile → action plan top, suggestions below; desktop → suggestions left, plan sticky right */}
          {isMobile ? (
            <div
              style={{
                display: "grid",
                gap: 16,
              }}
            >
              {renderActionPlanCard()}
              {renderSuggestionsColumn()}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.1fr)",
                gap: 16,
              }}
            >
              {renderSuggestionsColumn()}
              <div
                style={{
                  position: "sticky",
                  top: 88,
                  alignSelf: "flex-start",
                }}
              >
                {renderActionPlanCard()}
              </div>
            </div>
          )}
        </div>
      </main>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @media (max-width: 900px) {
            .landing__main {
              padding: 72px 16px 24px;
            }
          }
        `}
      </style>
    </div>
  );
}










