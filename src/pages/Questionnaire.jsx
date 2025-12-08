// src/pages/Questionnaire.jsx
import React, { useEffect, useMemo, useState } from "react";
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
import { hasCriticalPillar, DEFAULT_CRITICAL_THRESHOLD } from "../utils/criticalGuard";

export default function Questionnaire({ questions = [], sector }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [assessmentId, setAssessmentId] = useState(null);

  const [active, setActive] = useState(0);
  // answers[qid] = { label: string, score: number (0–4) }
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pillars = ["Environmental", "Social", "Governance"];

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

  // ---------- HELPERS ----------
  const grouped = useMemo(() => {
    const byPillar = { Environmental: [], Social: [], Governance: [] };
    (questions || []).forEach((q) => {
      const pillar =
        q.category ||
        (q.pillar === "E"
          ? "Environmental"
          : q.pillar === "S"
          ? "Social"
          : q.pillar === "G"
          ? "Governance"
          : null);
      if (!pillar) return;
      const localIndex = byPillar[pillar].length;
      const qid = q.id || `${sector}:${pillar}:${localIndex}`;
      byPillar[pillar].push({
        ...q,
        qid,
        pillar,
        text: q.question || q.text || "",
      });
    });
    return byPillar;
  }, [questions, sector]);

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

  const handleAnswer = async (qid, option) => {
    // option is one of SCALE_OPTIONS
    const updated = {
      ...answers,
      [qid]: {
        label: option.label,
        score: option.score,
      },
    };
    setAnswers(updated);

    if (!user) return;
    try {
      const id = await ensureDraft(); // guarantees ID
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

  const goPrev = () => setActive((i) => Math.max(0, i - 1));
  const goNext = () => setActive((i) => Math.min(pillars.length - 1, i + 1));

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

  // ---------- SCORING (robust, 0–4 scale) ----------
// ---------- SCORING (robust, uses scoring.js with 0–4 scale) ----------
const safeScoreAssessment = () => {
  try {
    const res = scoreAssessmentOriginal(questions, answers, {
      sector,
      allowPartial: false,
      treatUnknownAsZero: false,
    });

    if (!res || typeof res !== "object") {
      throw new Error("scoreAssessment returned nothing");
    }

    const { pillars, overall, rating } = res; // 👈 take rating too

    if (
      !pillars ||
      ["E", "S", "G"].some(
        (k) => typeof pillars[k] !== "number" || Number.isNaN(pillars[k])
      )
    ) {
      throw new Error("pillars invalid");
    }
    if (typeof overall !== "number" || Number.isNaN(overall)) {
      throw new Error("overall invalid");
    }

    const pillarScores = {
      E: pillars.E / 100,
      S: pillars.S / 100,
      G: pillars.G / 100,
    };
    const overall01 = overall / 100;

    return { pillarScores, overall: overall01, rating }; // 👈 include rating
  } catch (err) {
    console.warn("[scoreAssessment] failed, using fallback:", err);

    // fallback like we already wrote
    const scorePillar = (key) => {
      const list = grouped[key] || [];
      if (!list.length) return 0;

      let totalScore = 0;
      let answeredCount = 0;

      list.forEach((q) => {
        const ans = answers[q.qid];
        if (!ans) return;

        let numeric = 0;
        if (typeof ans === "object" && typeof ans.score === "number") {
          numeric = ans.score;
        } else if (ans === "Yes") {
          numeric = 1;
        } else {
          numeric = 0;
        }

        if (numeric < 0) numeric = 0;
        if (numeric > 4) numeric = 4;

        totalScore += numeric;
        answeredCount += 1;
      });

      if (!answeredCount) return 0;
      const maxScore = answeredCount * 4;
      return maxScore ? totalScore / maxScore : 0;
    };

    const E = scorePillar("Environmental");
    const S = scorePillar("Social");
    const G = scorePillar("Governance");

    const pillarScores = { E, S, G };
    const overall = (E + S + G) / 3;

    // fallback rating: convert % to numericToRating if you want, or leave null
    return { pillarScores, overall, rating: null };
  }
};



  // ---------- SUBMIT ----------
const handleSubmitAll = async () => {
  if (!user) return;
  setIsSubmitting(true);

  try {
    const id = await ensureDraft();
    console.log("[submit] draft id:", id);

    const { pillarScores, overall, rating } = safeScoreAssessment();
    console.log("[submit] scores:", pillarScores, "overall:", overall);

    const critical = hasCriticalPillar(
      pillarScores,
      DEFAULT_CRITICAL_THRESHOLD
    );
    console.log("[submit] critical:", critical);

    const ref = doc(db, "users", user.uid, "assessments", id);

    // 🔹 Save final assessment document
    try {
      await updateDoc(ref, {
        answers,
        sector,
        pillarScores,
        overall,
        rating, // keep rating
        critical,
        threshold: DEFAULT_CRITICAL_THRESHOLD,
        status: "submitted",
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("[submit] updateDoc failed, trying setDoc merge:", e);
      await setDoc(
        ref,
        {
          answers,
          sector,
          pillarScores,
          overall,
          rating,
          critical,
          threshold: DEFAULT_CRITICAL_THRESHOLD,
          status: "submitted",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // ✅ NEW: update user.lastAssessmentAt for dashboard reminders
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

    // 🔹 Critical flow
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
          scores: { ...pillarScores, overall },
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

    // 🔹 Normal flow
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

  if (!user) return <div style={{ padding: 24 }}>Devi effettuare il login.</div>;

  // ---------- UI ----------
  return (
    <div className="landing" style={{ alignItems: "center" }}>
      <main className="landing__main" style={{ maxWidth: 960 }}>
        <h1 className="landing__title">ESG Assessment</h1>
        <p className="landing__subtitle">Sector: {sector}</p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          {pillars.map((p, i) => (
            <button
              key={p}
              className={`btn ${i === active ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setActive(i)}
              type="button"
            >
              {p}
              <span style={{ marginLeft: 8, opacity: 0.75 }}>
                {progressFor(p)}%
              </span>
            </button>
          ))}
        </div>

        {/* Card */}
        <section
          className="card"
          style={{ padding: 16, borderRadius: 16, border: "1px solid #e2e8f0" }}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 12,
            }}
          >
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

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
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
              onClick={goPrev}
              disabled={active === 0 || isSubmitting}
              type="button"
            >
              Back
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





