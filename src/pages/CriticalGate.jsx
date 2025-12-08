// src/pages/CriticalGate.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../components/landing.css";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

// Env var for consultation link; fallback to your Contact page
const CONSULT_URL =
  process.env.REACT_APP_VIRIDIS_CONSULT_URL ||
  "https://www.viridisconsultancy.com/contact";

export default function CriticalGate() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  // expected state: { scores?, threshold?, sector?, assessmentId?, answers? }

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // primary page data (hydrate from state first)
  const [sector, setSector] = useState(state?.sector || "—");
  const [answers, setAnswers] = useState(state?.answers || null);
  const [scores, setScores] = useState(state?.scores || null); // {E,S,G,overall} OR {environmental,...}
  const assessmentId = state?.assessmentId || null;
  const threshold =
    typeof state?.threshold === "number" ? state.threshold : 0.2; // 20%

  // Normalize any upstream score shape into {E,S,G,overall} numbers
  const normalizeScores = (raw) => {
    if (!raw) return null;
    const E = raw.E ?? raw.environmental ?? null;
    const S = raw.S ?? raw.social ?? null;
    const G = raw.G ?? raw.governance ?? null;
    const overall = raw.overall ?? raw.score ?? null;
    return { E, S, G, overall };
  };

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // Hydration strategy:
  // 1) If we already have scores from state, we're done.
  // 2) Else if we got assessmentId, load that document.
  // 3) Else load the LATEST assessment for the user.
  useEffect(() => {
    let cancelled = false;

    const loadSpecificAssessment = async (uid, id) => {
      const ref = doc(db, "users", uid, "assessments", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const d = snap.data() || {};
      const mapped = normalizeScores({
        E: d?.esgScores?.E ?? d?.pillarScores?.E,
        S: d?.esgScores?.S ?? d?.pillarScores?.S,
        G: d?.esgScores?.G ?? d?.pillarScores?.G,
        overall: d?.overall ?? d?.score,
      });
      return {
        sector: d?.sector || "—",
        answers: d?.answers || null,
        scores: mapped,
      };
    };

    const loadLatestAssessment = async (uid) => {
      const q = query(
        collection(db, "users", uid, "assessments"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0].data() || {};
      const mapped = normalizeScores({
        E: d?.esgScores?.E ?? d?.pillarScores?.E,
        S: d?.esgScores?.S ?? d?.pillarScores?.S,
        G: d?.esgScores?.G ?? d?.pillarScores?.G,
        overall: d?.overall ?? d?.score,
      });
      return {
        sector: d?.sector || "—",
        answers: d?.answers || null,
        scores: mapped,
      };
    };

    const hydrate = async () => {
      // If already hydrated from state, nothing to do
      if (scores) return;

      if (!user) return;
      setLoading(true);
      try {
        let payload = null;
        if (assessmentId) {
          payload = await loadSpecificAssessment(user.uid, assessmentId);
        }
        if (!payload) {
          payload = await loadLatestAssessment(user.uid);
        }
        if (cancelled) return;

        if (payload) {
          setSector(payload.sector || "—");
          setAnswers(payload.answers || null);
          setScores(payload.scores || null);
        }
      } catch (e) {
        console.error("[CriticalGate] hydration failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, assessmentId]);

  // Percent formatter (accepts 0..1 or 0..100)
  const fmtPct = (v) => {
    if (typeof v !== "number" || Number.isNaN(v)) return "—";
    const pct = v <= 1 ? Math.round(v * 100) : Math.round(v);
    return `${pct}%`;
  };

  const belowList = useMemo(() => {
    const out = [];
    const toUnit = (v) =>
      typeof v === "number" ? (v <= 1 ? v : v / 100) : null;

    const e = toUnit(scores?.E);
    const s = toUnit(scores?.S);
    const g = toUnit(scores?.G);

    if (e !== null && e < threshold) out.push("Environmental");
    if (s !== null && s < threshold) out.push("Social");
    if (g !== null && g < threshold) out.push("Governance");
    return out;
  }, [scores, threshold]);

  const title = "Critical ESG Alert";
  const detail = scores
    ? belowList.length
      ? `The following pillars are below the threshold (${Math.round(
          threshold * 100
        )}%): ${belowList.join(", ")}.`
      : "At least one critical requirement was not met."
    : "A critical issue has been detected in the results.";

  const goSuggestions = () => {
    navigate("/suggestions", {
      state: { sector, scores, threshold, answers },
    });
  };

  const goDashboard = () => {
    navigate("/dashboard");
  };

  const openConsultation = () => {
    // Force open in new tab for external links; same-tab if internal route
    const isExternal = /^https?:\/\//.test(CONSULT_URL);
    if (isExternal) {
      window.open(CONSULT_URL, "_blank", "noopener,noreferrer");
    } else {
      navigate(CONSULT_URL);
    }
  };

  return (
    <div
      className="page"
      style={{ display: "flex", justifyContent: "center", padding: "32px 16px" }}
    >
      <main className="page__main" style={{ width: "100%", maxWidth: 840 }}>
        <h1 style={{ margin: "4px 0 6px" }}>{title}</h1>
        <p style={{ color: "#475569", margin: 0 }}>Sector: {sector}</p>

        <div className="alert alert--error" role="alert" style={{ marginTop: 12 }}>
          <strong>Warning:</strong> {detail} We recommend reviewing your answers
          and ESG strategy before proceeding.
        </div>

        {/* Consultation banner */}
        <div
          className="card"
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#ecfdf5",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 700, color: "#065f46" }}>
              Get tailored guidance from{" "}
              <span style={{ textDecoration: "underline" }}>
                Viridis Consulting
              </span>
              .
            </div>
            <div style={{ color: "#065f46" }}>
              Book a short consultation to diagnose gaps and prioritize next
              steps for {sector}.
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={openConsultation}
              className="btn btn--primary"
              style={{ cursor: "pointer" }}
            >
              Book a Consultation
            </button>
          </div>
        </div>

        {/* Scores */}
        <section
          className="card"
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
          }}
        >
          <h2 style={{ margin: "0 0 12px" }}>
            Score Details {loading ? "(loading…)" : ""}
          </h2>

          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
          >
            <Metric
              label="Environmental"
              value={fmtPct(scores?.E)}
              warn={belowList.includes("Environmental")}
            />
            <Metric
              label="Social"
              value={fmtPct(scores?.S)}
              warn={belowList.includes("Social")}
            />
            <Metric
              label="Governance"
              value={fmtPct(scores?.G)}
              warn={belowList.includes("Governance")}
            />
            <Metric label="Overall" value={fmtPct(scores?.overall)} />
          </div>

          <p style={{ color: "#475569", marginTop: 12 }}>
            Applied threshold: <strong>{Math.round(threshold * 100)}%</strong>.
            Improve the critical pillars to unlock the overall score.
          </p>

          {/* Actions (Back removed) */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn--primary" onClick={goSuggestions}>
              See Suggestions
            </button>
            <button className="btn" onClick={goDashboard}>
              Go to Dashboard
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, warn }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: warn ? "#fff7f7" : "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: warn ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
      {warn && <div style={{ fontSize: 12, color: "#b42318" }}>Below threshold</div>}
    </div>
  );
}




