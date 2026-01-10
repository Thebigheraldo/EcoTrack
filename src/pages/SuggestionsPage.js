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
import ecoTrackLogo from "../assets/ecotrack-logo.png";


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

/* ---------- Date helpers (planner) ---------- */

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday-based week start (Europe-friendly)
function getWeekStartMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // Sun=0 .. Sat=6
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function getNextWeeks(count = 4, fromDate = new Date()) {
  const start = getWeekStartMonday(fromDate);
  return Array.from({ length: count }, (_, i) => {
    const weekStart = addDays(start, i * 7);
    const weekEnd = addDays(weekStart, 6);
    return { weekStart, weekEnd, key: formatDateISO(weekStart) };
  });
}

function isISODateInRange(iso, startDate, endDate) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const s = new Date(startDate);
  const e = new Date(endDate);
  s.setHours(0, 0, 0, 0);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

// Count OPEN (not completed) scheduled items inside a week range
function countOpenScheduledInWeek(items, weekStart, weekEnd) {
  return items.filter((i) => {
    if (i.completed) return false;
    const iso = i.scheduledFor ? String(i.scheduledFor) : "";
    return isISODateInRange(iso, weekStart, weekEnd);
  }).length;
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
    if (effort === "Low") timeframe = "0–6 months";
    else if (effort === "Medium") timeframe = "6–12 months";
    else timeframe = "12+ months";
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

  // Planner controls
  const [planHorizon, setPlanHorizon] = useState("4w"); // "4w" | "8w"
  const weeksToShow = planHorizon === "8w" ? 8 : 4;

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

      const chosen = docs.find((d) => d.status === "submitted") || docs[0] || null;

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
      list = list.filter((s) => (s.pillar || "").toUpperCase() === filterPillar);
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
      const score = (s) => impactRank(s.impact) * 10 + effortRank(s.effort);
      return score(b) - score(a);
    });

    return list;
  }, [suggestions, filterPillar, filterImpact, filterEffort, filterTimeframe, search, sortBy]);

  /* ---------- Action plan helpers ---------- */

  const isInPlan = (suggestion) => actionPlan.some((item) => item.suggestionId === suggestion.id);

  const handleAddToPlan = async (suggestion) => {
    if (!userId) return;
    if (isInPlan(suggestion)) return;

    setPlanError("");

    const text =
      suggestion.text || (typeof suggestion === "string" ? suggestion : "Action item");

    const payload = {
      suggestionId: suggestion.id,
      text,
      tags: suggestion.tags || [],
      impact: normalizeImpact(suggestion.impact),
      effort: normalizeEffort(suggestion.effort),
      timeframe: normalizeTimeframe(suggestion.timeframe),
      completed: false,
      scheduledFor: null, // planner field (ISO date string)
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
      setActionPlan((prev) => prev.map((p) => (p.id === item.id ? { ...p, completed: newCompleted } : p)));
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

    const impactRank = (impact) => (impact === "High" ? 3 : impact === "Medium" ? 2 : 1);

    let pool = suggestions.filter((s) => !isComplianceSuggestion(s));
    if (!pool.length) pool = [...suggestions];

    let quick = pool.filter((s) => normalizeEffort(s.effort) === "Low");

    if (!quick.length) {
      quick = pool.filter(
        (s) => normalizeEffort(s.effort) === "Medium" && normalizeImpact(s.impact) === "High"
      );
    }

    if (!quick.length) {
      quick = [...pool].sort(
        (a, b) => impactRank(normalizeImpact(b.impact)) - impactRank(normalizeImpact(a.impact))
      );
    }

    quick = quick.slice(0, 5);
    if (!quick.length) {
      setPlanError("Couldn't find any suggestions suitable as quick wins.");
      return;
    }

    for (const s of quick) {
      if (!isInPlan(s)) {
        // eslint-disable-next-line no-await-in-loop
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

    const impactRank = (impact) => (impact === "High" ? 3 : impact === "Medium" ? 2 : 1);

    let compl = suggestions.filter((s) => isComplianceSuggestion(s));
    if (!compl.length) {
      compl = suggestions.filter((s) => (s.pillar || "").toUpperCase() === "G");
    }

    compl = compl
      .sort(
        (a, b) => impactRank(normalizeImpact(b.impact)) - impactRank(normalizeImpact(a.impact))
      )
      .slice(0, 5);

    if (!compl.length) {
      setPlanError("Couldn't find suggestions tagged as governance/compliance.");
      return;
    }

    for (const s of compl) {
      if (!isInPlan(s)) {
        // eslint-disable-next-line no-await-in-loop
        await handleAddToPlan(s);
      }
    }
  };

  /* ---------- Scenario builder ---------- */

  const currentOverall = assessmentMeta?.overall ?? null;

  const estimatedImpact = useMemo(() => {
    if (!actionPlan.length) return { overallDelta: 0, futureOverall: currentOverall ?? null };

    const impactScore = (impact) => (impact === "High" ? 3 : impact === "Medium" ? 2 : 1);

    const totalImpact = actionPlan.reduce(
      (sum, item) => sum + impactScore(normalizeImpact(item.impact || "Medium")),
      0
    );

    const delta = Math.min(20, Math.round(totalImpact * 1.5));
    const future =
      typeof currentOverall === "number" ? Math.min(100, currentOverall + delta) : null;

    return { overallDelta: delta, futureOverall: future };
  }, [actionPlan, currentOverall]);

  /* ---------- Planner (auto weekly plan) ---------- */

  const priorityScore = (item) => {
    const impact = normalizeImpact(item.impact);
    const effort = normalizeEffort(item.effort);
    const impactRank = impact === "High" ? 3 : impact === "Medium" ? 2 : 1;
    const effortRank = effort === "Low" ? 3 : effort === "Medium" ? 2 : 1; // low effort => higher
    return impactRank * 10 + effortRank;
  };

  // STRICT 1/week: only fills EMPTY weeks, only for currently unscheduled open items.
  const handleGenerateSchedule = async () => {
    if (!userId) return;
    setPlanError("");

    const openItems = actionPlan.filter((i) => !i.completed);

    const candidates = openItems
      .filter((i) => !i.scheduledFor || String(i.scheduledFor).trim() === "")
      .sort((a, b) => priorityScore(b) - priorityScore(a));

    if (!candidates.length) {
      setPlanError("All open actions are already scheduled.");
      return;
    }

    const weeks = getNextWeeks(weeksToShow, new Date());
    const assignments = new Map(); // itemId -> ISO date
    let cursor = 0;

    for (const w of weeks) {
      const alreadyHasOne = countOpenScheduledInWeek(openItems, w.weekStart, w.weekEnd) >= 1;
      if (alreadyHasOne) continue;
      if (cursor >= candidates.length) break;

      const item = candidates[cursor];
      cursor += 1;

      const iso = formatDateISO(addDays(w.weekStart, 0)); // Monday
      assignments.set(item.id, iso);
    }

    if (!assignments.size) {
      setPlanError(
        "No weeks available: each upcoming week already has an open scheduled action. Use Regenerate to enforce 1/week."
      );
      return;
    }

    setActionPlan((prev) =>
      prev.map((it) =>
        assignments.has(it.id) ? { ...it, scheduledFor: assignments.get(it.id) } : it
      )
    );

    try {
      await Promise.all(
        Array.from(assignments.entries()).map(([itemId, iso]) =>
          updateDoc(doc(db, "users", userId, "actionPlan", itemId), { scheduledFor: iso })
        )
      );

      const remaining = candidates.length - assignments.size;
      if (remaining > 0) {
        setPlanError(
          `Scheduled ${assignments.size} actions (1/week). ${remaining} remain unscheduled — increase horizon to schedule more weeks.`
        );
      }
    } catch (e) {
      console.error("Error generating schedule", e);
      setPlanError(e.message || "Failed to generate schedule.");
    }
  };

  // ENFORCE 1/week: overwrites schedules for ALL open items.
  const handleRegenerateSchedule = async () => {
    if (!userId) return;
    setPlanError("");

    const openItems = actionPlan.filter((i) => !i.completed);
    if (!openItems.length) {
      setPlanError("No open actions to schedule.");
      return;
    }

    const weeks = getNextWeeks(weeksToShow, new Date());
    const sorted = [...openItems].sort((a, b) => priorityScore(b) - priorityScore(a));

    // Build a strict assignment: max 1 per week
    const assignments = new Map(); // itemId -> ISO date | null
    let cursor = 0;

    for (const w of weeks) {
      if (cursor >= sorted.length) break;
      const item = sorted[cursor];
      cursor += 1;

      const iso = formatDateISO(addDays(w.weekStart, 0)); // Monday
      assignments.set(item.id, iso);
    }

    // Everyone else becomes unscheduled (null)
    for (let i = cursor; i < sorted.length; i += 1) {
      assignments.set(sorted[i].id, null);
    }

    // Optimistic local update (only open items overwritten)
    setActionPlan((prev) =>
      prev.map((it) => {
        if (it.completed) return it;
        if (!assignments.has(it.id)) return { ...it, scheduledFor: null };
        return { ...it, scheduledFor: assignments.get(it.id) };
      })
    );

    try {
      await Promise.all(
        Array.from(assignments.entries()).map(([itemId, iso]) =>
          updateDoc(doc(db, "users", userId, "actionPlan", itemId), { scheduledFor: iso })
        )
      );

      const scheduledCount = Array.from(assignments.values()).filter(Boolean).length;
      const remaining = openItems.length - scheduledCount;
      if (remaining > 0) {
        setPlanError(
          `Regenerated schedule (strict 1/week). Scheduled ${scheduledCount}. ${remaining} remain unscheduled — increase horizon to schedule more weeks.`
        );
      }
    } catch (e) {
      console.error("Error regenerating schedule", e);
      setPlanError(e.message || "Failed to regenerate schedule.");
    }
  };

  const handleClearSchedule = async () => {
    if (!userId) return;
    setPlanError("");

    const itemsWithSchedule = actionPlan.filter((i) => i.scheduledFor);
    if (!itemsWithSchedule.length) return;

    // Optimistic local update
    setActionPlan((prev) => prev.map((it) => ({ ...it, scheduledFor: null })));

    try {
      await Promise.all(
        itemsWithSchedule.map((item) =>
          updateDoc(doc(db, "users", userId, "actionPlan", item.id), { scheduledFor: null })
        )
      );
    } catch (e) {
      console.error("Error clearing schedule", e);
      setPlanError(e.message || "Failed to clear schedule.");
    }
  };

  /* ---------- Export Action Plan PDF ---------- */

/* ---------- Export Action Plan PDF (PRO + LOGO) ---------- */

const handleExportPlanPDF = async () => {
  if (!actionPlan.length) return;

  // ---- Helpers (local) ----
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

  const formatISOShort = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return safeText(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  };

  const completion = (() => {
    const total = actionPlan.length;
    const done = actionPlan.filter((i) => i.completed).length;
    const open = total - done;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, open, pct };
  })();

  const scheduledOpen = actionPlan
    .filter((i) => !i.completed && i.scheduledFor)
    .slice()
    .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)));

  const unscheduledOpen = actionPlan
    .filter((i) => !i.completed && (!i.scheduledFor || String(i.scheduledFor).trim() === ""))
    .slice()
    .sort((a, b) => {
      const impactRank = (x) => (normalizeImpact(x) === "High" ? 3 : normalizeImpact(x) === "Medium" ? 2 : 1);
      const effortRank = (x) => (normalizeEffort(x) === "Low" ? 3 : normalizeEffort(x) === "Medium" ? 2 : 1);
      const score = (it) => impactRank(it.impact) * 10 + effortRank(it.effort);
      return score(b) - score(a);
    });

  // ---- Build PDF ----
  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  const PAGE = {
    w: pdf.internal.pageSize.getWidth(),
    h: pdf.internal.pageSize.getHeight(),
    l: 56,
    r: 56,
    t: 56,
    b: 46,
  };

  // ---- Load logo as DataURL (safe) ----
  let logoDataUrl = null;
  try {
    logoDataUrl = await fetchAsDataURL(ecoTrackLogo);
  } catch (e) {
    console.warn("Logo load failed, continuing without logo.", e);
    logoDataUrl = null;
  }

  const drawHeader = () => {
    // Top brand bar
    pdf.setFillColor(...BRAND.green);
    pdf.rect(0, 0, PAGE.w, 64, "F");

    // Title (left)
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text("EcoTrack — ESG Action Plan", PAGE.l, 40);

    // Logo (top-right, inside bar)
    if (logoDataUrl) {
      try {
        const props = pdf.getImageProperties(logoDataUrl);
        const logoH = 28; // <- cambia se lo vuoi più grande/piccolo
        const logoW = (props.width / props.height) * logoH;
        const x = PAGE.w - PAGE.r - logoW;
        const y = 18; // dentro la barra verde (altezza 64)
        pdf.addImage(logoDataUrl, "PNG", x, y, logoW, logoH, undefined, "FAST");
      } catch (e) {
        console.warn("addImage failed, continuing without logo.", e);
      }
    }

    // Meta card (white)
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

    // Summary (right)
    const rightX = PAGE.w - PAGE.r - 220;
    pdf.setTextColor(...BRAND.dark);
    pdf.setFont("helvetica", "bold");
    pdf.text("Summary", rightX, cardY + 24);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...BRAND.muted);
    pdf.text(`Total: ${completion.total}`, rightX, cardY + 42);
    pdf.text(`Done: ${completion.done}`, rightX + 80, cardY + 42);
    pdf.text(`Open: ${completion.open}`, rightX + 150, cardY + 42);

    const barX = rightX;
    const barY = cardY + 54;
    const barW = 190;
    const barH2 = 8;

    pdf.setDrawColor(...BRAND.line);
    pdf.setFillColor(...BRAND.bg);
    pdf.roundedRect(barX, barY, barW, barH2, 4, 4, "FD");

    pdf.setFillColor(...BRAND.green);
    pdf.roundedRect(barX, barY, Math.max(6, (barW * completion.pct) / 100), barH2, 4, 4, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BRAND.dark);
    pdf.text(`${completion.pct}%`, barX + barW + 10, barY + 8);
  };

  const drawFooter = (pageNumber, pageCount) => {
    const y = PAGE.h - 18;
    pdf.setDrawColor(...BRAND.line);
    pdf.line(PAGE.l, PAGE.h - PAGE.b + 10, PAGE.w - PAGE.r, PAGE.h - PAGE.b + 10);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.muted);
    pdf.text("EcoTrack — Internal use", PAGE.l, y);
    pdf.text(`Page ${pageNumber} of ${pageCount}`, PAGE.w - PAGE.r - 90, y);
  };

  drawHeader();

  let cursorY = 180;

  // --- Section: Upcoming schedule ---
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...BRAND.dark);
  pdf.text("Upcoming schedule", PAGE.l, cursorY);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.muted);
  pdf.text("Open actions that already have a scheduled date.", PAGE.l, cursorY + 14);

  const scheduledRows = scheduledOpen.length
    ? scheduledOpen.map((it, idx) => [
        idx + 1,
        formatISOShort(it.scheduledFor),
        safeText(it.text),
        normalizeImpact(it.impact),
        normalizeEffort(it.effort),
        "Planned",
      ])
    : [["—", "—", "No scheduled open actions yet.", "—", "—", "—"]];

  autoTable(pdf, {
    startY: cursorY + 24,
    head: [["#", "Date", "Action", "Impact", "Effort", "Status"]],
    body: scheduledRows,
    theme: "striped",
    margin: { left: PAGE.l, right: PAGE.r },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 6,
      lineColor: BRAND.line,
      lineWidth: 0.5,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: BRAND.green,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 70 },
      2: { cellWidth: PAGE.w - PAGE.l - PAGE.r - (26 + 70 + 70 + 62 + 62) },
      3: { cellWidth: 70 },
      4: { cellWidth: 62 },
      5: { cellWidth: 62 },
    },
    didDrawPage: (data) => {
      const pageCount = pdf.internal.getNumberOfPages();
      drawFooter(data.pageNumber, pageCount);
    },
  });

  cursorY = pdf.lastAutoTable.finalY + 26;

  // --- Section: Backlog (unscheduled) ---
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...BRAND.dark);
  pdf.text("Backlog (unscheduled)", PAGE.l, cursorY);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.muted);
  pdf.text("Open actions not scheduled yet (priority order).", PAGE.l, cursorY + 14);

  const backlogRows = unscheduledOpen.length
    ? unscheduledOpen.map((it, idx) => [
        idx + 1,
        safeText(it.text),
        normalizeImpact(it.impact),
        normalizeEffort(it.effort),
        normalizeTimeframe(it.timeframe),
      ])
    : [["—", "No unscheduled open actions.", "—", "—", "—"]];

  autoTable(pdf, {
    startY: cursorY + 24,
    head: [["#", "Action", "Impact", "Effort", "Timeframe"]],
    body: backlogRows,
    theme: "striped",
    margin: { left: PAGE.l, right: PAGE.r },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 6,
      lineColor: BRAND.line,
      lineWidth: 0.5,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: BRAND.dark,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - (26 + 70 + 62 + 90) },
      2: { cellWidth: 70 },
      3: { cellWidth: 62 },
      4: { cellWidth: 90 },
    },
    didDrawPage: (data) => {
      const pageCount = pdf.internal.getNumberOfPages();
      drawFooter(data.pageNumber, pageCount);
    },
  });

  const fileName = `EcoTrack_ActionPlan_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
};


  /* ---------- Misc helpers ---------- */

  const completedCount = actionPlan.filter((i) => i.completed).length;
  const completionRatio = actionPlan.length > 0 ? completedCount / actionPlan.length : 0;

  const getTargetDateForItem = (item) => {
    const base =
      item.createdAt && item.createdAt.toDate ? item.createdAt.toDate() : new Date();

    const tf = normalizeTimeframe(item.timeframe || "").toLowerCase();
    const d = new Date(base);

    if (tf.includes("quick") || tf.includes("0–6") || tf.includes("0-6")) d.setMonth(d.getMonth() + 3);
    else if (tf.includes("6–12") || tf.includes("6-12")) d.setMonth(d.getMonth() + 9);
    else d.setMonth(d.getMonth() + 12);

    return formatDateISO(d);
  };

  const weeks = useMemo(() => getNextWeeks(weeksToShow, new Date()), [weeksToShow]);

  const scheduledByWeek = useMemo(() => {
    const map = new Map(weeks.map((w) => [w.key, []]));
    const unscheduled = [];

    for (const item of actionPlan) {
      if (item.completed) continue; // planner focuses on open items
      const iso = item.scheduledFor ? String(item.scheduledFor) : "";
      const week = weeks.find((w) => isISODateInRange(iso, w.weekStart, w.weekEnd));
      if (week) map.get(week.key).push(item);
      else unscheduled.push(item);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => String(a.scheduledFor || "").localeCompare(String(b.scheduledFor || "")));
      map.set(k, arr);
    }

    unscheduled.sort((a, b) => priorityScore(b) - priorityScore(a));

    return { map, unscheduled };
  }, [actionPlan, weeks]);

  const unscheduledOpenCount = scheduledByWeek.unscheduled.length;

  /* ---------- Loading state ---------- */

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

  /* ---------- Render helpers ---------- */

  const renderPlanner = () => (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
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
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            Planner (Next {weeksToShow} weeks)
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Strict rule: <strong>only 1 open action per week</strong>.
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            Unscheduled open actions: <strong>{unscheduledOpenCount}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={planHorizon}
            onChange={(e) => setPlanHorizon(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              background: "#fff",
            }}
          >
            <option value="4w">4 weeks</option>
            <option value="8w">8 weeks</option>
          </select>

          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: 12, padding: "4px 8px" }}
            onClick={handleGenerateSchedule}
            disabled={unscheduledOpenCount === 0}
            title="Schedules only unscheduled items into empty weeks."
          >
            Generate plan
          </button>

          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: 12, padding: "4px 8px" }}
            onClick={handleRegenerateSchedule}
            disabled={actionPlan.filter((i) => !i.completed).length === 0}
            title="Overwrites schedules for all open items to enforce 1/week."
          >
            Regenerate (enforce 1/week)
          </button>

          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: 12, padding: "4px 8px" }}
            onClick={handleClearSchedule}
            disabled={!actionPlan.some((i) => i.scheduledFor)}
          >
            Clear schedule
          </button>
        </div>
      </div>

      {/* Weeks board */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {weeks.map((w, idx) => {
          const items = scheduledByWeek.map.get(w.key) || [];
          const label = `Week ${idx + 1}`;
          const range = `${formatDateISO(w.weekStart)} → ${formatDateISO(w.weekEnd)}`;

          return (
            <div
              key={w.key}
              style={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: 10,
                minHeight: 90,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{range}</div>
                </div>
                <Badge>{items.length} items</Badge>
              </div>

              {items.length ? (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {items.slice(0, 6).map((item) => (
                    <li key={item.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleCompleted(item)}
                        style={{
                          marginTop: 2,
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
                        aria-label={item.completed ? "Mark as not completed" : "Mark as completed"}
                      >
                        ✓
                      </button>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.25 }}>
                          {item.text}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 11, color: "#94a3b8" }}>
                          Scheduled: <strong>{item.scheduledFor || "—"}</strong>
                        </div>
                      </div>
                    </li>
                  ))}
                  {items.length > 6 && (
                    <li style={{ fontSize: 11, color: "#94a3b8" }}>+{items.length - 6} more</li>
                  )}
                </ul>
              ) : (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>No actions scheduled.</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unscheduled preview */}
      {unscheduledOpenCount > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>
            Unscheduled (priority order)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {scheduledByWeek.unscheduled.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 12, color: "#0f172a" }}>{item.text}</div>
                <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge>Impact: {normalizeImpact(item.impact)}</Badge>
                  <Badge>Effort: {normalizeEffort(item.effort)}</Badge>
                  <Badge>{normalizeTimeframe(item.timeframe)}</Badge>
                </div>
              </div>
            ))}
            {unscheduledOpenCount > 5 && (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                +{unscheduledOpenCount - 5} more unscheduled items
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

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
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Your Action Plan</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Build a backlog, then auto-schedule it into a weekly plan.
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
        <div style={{ marginBottom: 10, fontSize: 12, color: "#475569" }}>
          Scenario: if you implement all actions in this plan, your overall score could move from{" "}
          <strong>{currentOverall}%</strong> to{" "}
          <strong>{estimatedImpact.futureOverall ?? currentOverall}%</strong> (approx. +
          {estimatedImpact.overallDelta} pts).
        </div>
      )}

      {/* Errors */}
      {planError && <div style={{ marginBottom: 8, fontSize: 12, color: "#b91c1c" }}>{planError}</div>}

      {/* Planner */}
      {renderPlanner()}

      {/* Roadmap buttons + export */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
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
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Loading your plan…</div>
      ) : actionPlan.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>
          You haven’t added any actions yet. Use <strong>“Add to action plan”</strong> on the
          suggestions to build your roadmap.
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
                aria-label={item.completed ? "Mark as not completed" : "Mark as completed"}
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
                  {item.effort && <Badge>Effort: {normalizeEffort(item.effort)}</Badge>}
                  {item.timeframe && <Badge>{normalizeTimeframe(item.timeframe)}</Badge>}
                  <span>
                    Target date: <strong>{getTargetDateForItem(item)}</strong>
                  </span>
                  <span>
                    • Scheduled: <strong>{item.scheduledFor || "—"}</strong>
                  </span>
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
    <div style={{ display: "grid", gap: 12 }}>
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
              reasonLines.push(`This action targets your most fragile pillar (${worstPillarLabel}).`);
            } else if (s.pillar) {
              const pLabel =
                s.pillar === "E" ? "Environmental" : s.pillar === "S" ? "Social" : "Governance";
              reasonLines.push(`This action strengthens the ${pLabel} pillar.`);
            }

            if (s.tags && s.tags.length) {
              reasonLines.push(
                `Focus area: ${s.tags.slice(0, 3).join(", ")}${s.tags.length > 3 ? "…" : ""}`
              );
            }

            if (normalizeImpact(s.impact) === "High") {
              reasonLines.push("Estimated impact on your ESG maturity is high.");
            }

            const whyText = reasonLines.join(" ");

            return (
              <Card key={s.id}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#0f172a" }}>
                  {s.title || (typeof s.text === "string" ? s.text.split(".")[0] : "Suggested action")}
                </div>

                <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.4 }}>{s.text}</div>

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
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
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
            );
          })}
        </div>
      ) : (
        <Card>
          <div style={{ fontSize: 14, color: "#64748b", display: "flex", flexDirection: "column", gap: 8 }}>
            <span>No suggestions available yet. Run an assessment to unlock tailored actions.</span>
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

      <main className="landing__main" style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}>
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
              <div className="landing__subtitle" style={{ opacity: 0.9, fontSize: 14 }}>
                Turn your ESG assessment into a focused action plan and a weekly plan.
              </div>
            </div>

            <div className="landing__subtitle" style={{ opacity: 0.8, fontSize: 14 }}>
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
                <span style={{ fontSize: 14, color: "#64748b" }}>{sourceHint}</span>

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

          {/* Filters + search + sort */}
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

          {/* Layout */}
          {isMobile ? (
            <div style={{ display: "grid", gap: 16 }}>
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
              <div style={{ position: "sticky", top: 88, alignSelf: "flex-start" }}>
                {renderActionPlanCard()}
              </div>
            </div>
          )}
        </div>
      </main>

      <style>
        {`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            .landing__main { padding: 72px 16px 24px; }
          }
        `}
      </style>
    </div>
  );
}












