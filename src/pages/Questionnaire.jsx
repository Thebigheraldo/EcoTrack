// src/pages/Questionnaire.jsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../components/landing.css";
import { useNavigate } from "react-router-dom";

import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { scoreAssessment as scoreAssessmentOriginal } from "../utils/scoring";
import {
  hasCriticalPillar,
  DEFAULT_CRITICAL_THRESHOLD,
} from "../utils/criticalGuard";

export default function Questionnaire({ questions = [], sector }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [assessmentId, setAssessmentId] = useState(null);

  const [active, setActive] = useState(0);
  // answers[qid] = { label: string, score: number (0–4) }
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pillars = ["Environmental", "Social", "Governance"];

  // 🔹 refs for robust scroll-to-top
  const pageRef = useRef(null);
  const topRef = useRef(null);

  // 0–4 maturity scale options
  const SCALE_OPTIONS = [
    { label: "Not in place", score: 0 },
    { label: "Informal / ad hoc", score: 1 },
    { label: "Partially structured", score: 2 },
    { label: "Implemented & documented", score: 3 },
    { label: "Advanced / best practice", score: 4 },
  ];

  // ---------- AUTH ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // ---------- CANONICAL QUESTIONS (ensure stable IDs that match answers keys) ----------
  const canonicalQuestions = useMemo(() => {
    const byPillarCount = { Environmental: 0, Social: 0, Governance: 0 };

    return (questions || []).map((q) => {
      const pillar =
        q.category ||
        (q.pillar === "E"
          ? "Environmental"
          : q.pillar === "S"
          ? "Social"
          : q.pillar === "G"
          ? "Governance"
          : null);

      const idx = pillar ? byPillarCount[pillar]++ : 0;
      const id = q.id || `${sector || "sector"}:${pillar || "pillar"}:${idx}`;

      return {
        ...q,
        id,
        // keep readable text for UI
        text: q.question || q.text || "",
        // normalize pillar for grouping
        __pillar: pillar,
      };
    });
  }, [questions, sector]);

  // ---------- GROUPED UI MODEL ----------
  const grouped = useMemo(() => {
    const byPillar = { Environmental: [], Social: [], Governance: [] };

    (canonicalQuestions || []).forEach((q) => {
      const pillar = q.__pillar;
      if (!pillar || !byPillar[pillar]) return;

      byPillar[pillar].push({
        ...q,
        qid: q.id, // ✅ answers keys always match question.id
        pillar,
      });
    });

    return byPillar;
  }, [canonicalQuestions]);

  const currentKey = pillars[active];
  const currentQs = grouped[currentKey] || [];

  const progressFor = (key) => {
    const list = grouped[key] || [];
    const total = list.length;
    if (!total) return 0;

    const done = list.filter(
      (q) => answers[q.qid] && typeof answers[q.qid].score === "number"
    ).length;

    return Math.round((done / total) * 100);
  };

  const canProceed = () =>
    currentQs.every(
      (q) => answers[q.qid] && typeof answers[q.qid].score === "number"
    );

  const goPrev = () => setActive((i) => Math.max(0, i - 1));
  const goNext = () => setActive((i) => Math.min(pillars.length - 1, i + 1));

  // ---------- DRAFT CREATION ----------
  const ensureDraft = async () => {
    if (!user) throw new Error("No authenticated user");
    if (assessmentId) return assessmentId;

    const colRef = collection(db, "users", user.uid, "assessments");
    const docRef = await addDoc(colRef, {
      sector,
      status: "draft",
      answers: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setAssessmentId(docRef.id);
    return docRef.id;
  };

  // create early (best effort)
  useEffect(() => {
    (async () => {
      if (!user || !sector || assessmentId) return;
      try {
        await ensureDraft();
      } catch (e) {
        console.error("[ensureDraft early] failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sector]);

  // ---------- ANSWER HANDLER (saves draft) ----------
  const handleAnswer = async (qid, option) => {
    const updated = {
      ...answers,
      [qid]: { label: option.label, score: option.score },
    };
    setAnswers(updated);

    if (!user) return;

    try {
      const id = await ensureDraft();
      const ref = doc(db, "users", user.uid, "assessments", id);
      await updateDoc(ref, {
        answers: updated,
        status: "draft",
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("[draft save] updateDoc failed, trying setDoc merge:", e);
      try {
        const id = await ensureDraft();
        const ref = doc(db, "users", user.uid, "assessments", id);
        await setDoc(
          ref,
          { answers: updated, status: "draft", updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e2) {
        console.error("[draft save] setDoc merge failed:", e2);
      }
    }
  };

  // ---------- SCORING (single source of truth) ----------
  // Canonical: 0..100 => overallScore/envScore/socScore/govScore
  // Legacy:    0..1   => pillarScores/overall (kept for critical guard / older code paths)
  const safeScoreAssessment = () => {
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    try {
      const res = scoreAssessmentOriginal(canonicalQuestions, answers, {
        sector,
        allowPartial: false,
        treatUnknownAsZero: false,
      });

      if (!res || typeof res !== "object") throw new Error("No scorer result.");

      const scoredPillars = res.pillars || {};
      const overall100Raw = res.overall;

      if (
        typeof scoredPillars.E !== "number" ||
        typeof scoredPillars.S !== "number" ||
        typeof scoredPillars.G !== "number"
      ) {
        throw new Error("Invalid pillars.");
      }
      if (typeof overall100Raw !== "number" || Number.isNaN(overall100Raw)) {
        throw new Error("Invalid overall.");
      }

      const pillars100 = {
        E: clamp(scoredPillars.E, 0, 100),
        S: clamp(scoredPillars.S, 0, 100),
        G: clamp(scoredPillars.G, 0, 100),
      };
      const overall100 = clamp(overall100Raw, 0, 100);

      const pillarScores01 = {
        E: pillars100.E / 100,
        S: pillars100.S / 100,
        G: pillars100.G / 100,
      };
      const overall01 = overall100 / 100;

      return {
        pillars100,
        overall100,
        pillarScores01,
        overall01,
        rating: res.rating ?? null,
      };
    } catch (err) {
      console.warn("[scoreAssessment] failed, using fallback:", err);

      // Fallback: per pillar average from grouped UI model (0..4) -> % (0..100)
      const scorePillarPct = (key) => {
        const list = grouped[key] || [];
        if (!list.length) return 0;

        let total = 0;
        let count = 0;

        list.forEach((q) => {
          const ans = answers[q.qid];
          if (!ans) return;

          let v = 0;
          if (typeof ans === "object" && typeof ans.score === "number") v = ans.score;
          v = clamp(v, 0, 4);

          total += v;
          count += 1;
        });

        if (!count) return 0;
        const ratio01 = total / (count * 4);
        return Math.round(ratio01 * 100);
      };

      const E100 = scorePillarPct("Environmental");
      const S100 = scorePillarPct("Social");
      const G100 = scorePillarPct("Governance");
      const overall100 = Math.round((E100 + S100 + G100) / 3);

      return {
        pillars100: { E: E100, S: S100, G: G100 },
        overall100,
        pillarScores01: { E: E100 / 100, S: S100 / 100, G: G100 / 100 },
        overall01: overall100 / 100,
        rating: null,
      };
    }
  };

  // ---------- SUBMIT ----------
  const handleSubmitAll = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const id = await ensureDraft();

      const { pillars100, overall100, pillarScores01, overall01, rating } =
        safeScoreAssessment();

      // Critical guard uses 0..1 and threshold like 0.2
      const critical = hasCriticalPillar(
        pillarScores01,
        DEFAULT_CRITICAL_THRESHOLD
      );

      const ref = doc(db, "users", user.uid, "assessments", id);

      const payload = {
        answers,
        sector,
        status: "submitted",
        updatedAt: serverTimestamp(),
        completedAt: serverTimestamp(),

        // ✅ CANONICAL (0..100) — use these everywhere in UI
        overallScore: overall100,
        envScore: pillars100.E,
        socScore: pillars100.S,
        govScore: pillars100.G,
        rating: rating ?? null,

        // ✅ LEGACY (0..1) — keep if older pages/guards rely on them
        pillarScores: pillarScores01,
        overall: overall01,

        critical,
        threshold: DEFAULT_CRITICAL_THRESHOLD,
      };

      try {
        await updateDoc(ref, payload);
      } catch (e) {
        console.error("[submit] updateDoc failed, trying setDoc merge:", e);
        await setDoc(ref, payload, { merge: true });
      }

      // update user.lastAssessmentAt
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(
          userRef,
          { lastAssessmentAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error("[submit] failed to update lastAssessmentAt:", err);
      }

      if (critical) {
        try {
          const sendCriticalAlertEmail = httpsCallable(
            functions,
            "sendCriticalAlertEmail"
          );
          await sendCriticalAlertEmail({
            user: {
              uid: auth.currentUser?.uid || null,
              email: auth.currentUser?.email || null,
              displayName: auth.currentUser?.displayName || null,
            },
            profile: { sector },
            scores: { ...pillarScores01, overall: overall01 }, // 0..1
            scores100: { ...pillars100, overall: overall100 }, // 0..100
            threshold: DEFAULT_CRITICAL_THRESHOLD,
            source: "questionnaire-submit",
            assessmentId: id,
          });
        } catch (err) {
          console.error(
            "[submit] sendCriticalAlertEmail failed (non-blocking):",
            err
          );
        }

        navigate("/critical", { replace: true });
        return;
      }

      navigate("/dashboard", {
        state: { assessmentId: id, sector },
        replace: true,
      });
    } catch (e) {
      console.error("[submit] unexpected error:", e);
      alert("Submit failed. Open the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // reset on sector/questions changes
  useEffect(() => {
    setAnswers({});
    setActive(0);
  }, [sector, questions]);

  // ✅ FIX: Always go back to top when changing pillar
  useLayoutEffect(() => {
    if (pageRef.current && typeof pageRef.current.scrollTo === "function") {
      pageRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    const se = document.scrollingElement || document.documentElement;
    if (se) se.scrollTop = 0;
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [active]);

  if (!user) return <div style={{ padding: 24 }}>Devi effettuare il login.</div>;

  // ---------- UI ----------
  return (
    <div ref={pageRef} className="landing" style={{ alignItems: "center" }}>
      <main className="landing__main" style={{ maxWidth: 960 }}>
        <div ref={topRef} />

        <h1 className="landing__title">ESG Assessment</h1>
        <p className="landing__subtitle">Sector: {sector}</p>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            margin: "16px 0",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "0 8px",
          }}
        >
          {pillars.map((p, i) => (
            <button
              key={p}
              className={`btn ${i === active ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setActive(i)}
              type="button"
              style={{
                flex: "0 0 auto",
                padding: "8px 10px",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {p}
              <span style={{ marginLeft: 6, opacity: 0.75 }}>
                {progressFor(p)}%
              </span>
            </button>
          ))}
        </div>

        {/* Card */}
        <section
          className="card"
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
          }}
        >
          <h2 className="landing__subtitle" style={{ marginBottom: 8 }}>
            {currentKey}
          </h2>

          <div
            style={{
              height: 6,
              background: "#e2e8f0",
              borderRadius: 999,
              margin: "8px 0 16px",
            }}
          >
            <div
              style={{
                width: `${progressFor(currentKey)}%`,
                height: "100%",
                borderRadius: 999,
                background: "#111827",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {currentQs.map((q) => (
              <div
                key={q.qid}
                className="question-row"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #eef2f7",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    color: "#334155",
                    marginBottom: 10,
                  }}
                >
                  {q.text}
                </label>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SCALE_OPTIONS.map((opt) => {
                    const selected = answers[q.qid]?.score === opt.score;
                    return (
                      <button
                        key={opt.score}
                        type="button"
                        className={`btn ${
                          selected ? "btn--primary" : "btn--ghost"
                        }`}
                        onClick={() => handleAnswer(q.qid, opt)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              className="btn btn--ghost"
              onClick={() => {
                if (active === 0) {
                  navigate("/dashboard", { replace: true });
                } else {
                  goPrev();
                }
              }}
              disabled={isSubmitting}
              type="button"
            >
              {active === 0 ? "Back to dashboard" : "Back"}
            </button>

            <div style={{ flex: 1 }} />

            {active < pillars.length - 1 ? (
              <button
                className="btn btn--primary"
                onClick={goNext}
                disabled={!canProceed() || isSubmitting}
                type="button"
              >
                Next
              </button>
            ) : (
              <button
                className="btn btn--primary"
                onClick={handleSubmitAll}
                disabled={!canProceed() || isSubmitting}
                type="button"
              >
                {isSubmitting ? "Submitting..." : "Show results"}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}







