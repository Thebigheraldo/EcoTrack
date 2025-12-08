// src/pages/Onboarding.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import "../components/landing.css";

// Select moderna (stile coerente con landing.css)
function Select({ value, onChange, children }) {
  return (
    <div className="select-wrap">
      <select className="select-modern" value={value} onChange={onChange}>
        {children}
      </select>
      <svg
        className="select-chevron"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <path
          d="M7 10l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

const sectors = [
  "Manufacturing",
  "Agriculture/Food",
  "Textile/Fashion",
  "Tech",
  "Finance",
  "Construction",
  "Furniture",
  "Transportation",
];

const sizes = ["1-9", "10-49", "50-249", "250+"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    sector: "",
    size: "",
    country: "",
    turnover: "",
    csrd: "Unsure",
    goal: "compliance",
    timeline: "6-12",
  });

  // Prefill; if already completed, send to dashboard
  useEffect(() => {
    const load = async () => {
      const u = auth.currentUser;
      if (!u) return;

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const data = snap.data();

      if (data?.onboardingCompleted && data?.profile) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (data?.profile) {
        setForm((prev) => ({ ...prev, ...data.profile }));
      }
    };
    load();
  }, [navigate]);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const canNext1 = form.sector && form.size;
  const canNext2 = form.csrd && (form.country || form.turnover);

  const finish = async () => {
    setErr("");
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Utente non autenticato.");

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? snap.data() : {};

      // persist profile + flag
      await setDoc(
        ref,
        {
          uid: u.uid,
          email: u.email || "",
          name: u.displayName || (u.email?.split("@")[0] || ""),
          profile: { ...form },
          settings: {
            // default settings (same shape as in ProfileSettings)
            remindAssessments:
              typeof prev.settings?.remindAssessments === "boolean"
                ? prev.settings.remindAssessments
                : false,
          },
          onboardingCompleted: true,
          createdAt: prev.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ go to parametrized questionnaire for the chosen sector
      const sector = form.sector?.trim();
      if (sector) {
        navigate(`/questionnaire/${encodeURIComponent(sector)}`, {
          replace: true,
        });
      } else {
        // extremely defensive fallback
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || "Errore durante il salvataggio.");
    } finally {
      setBusy(false);
    }
  };

  const skipForNow = async () => {
    setErr("");
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Utente non autenticato.");

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? snap.data() : {};

      // 👉 Create a minimal but valid user doc so the app never has a "ghost" user
      await setDoc(
        ref,
        {
          uid: u.uid,
          email: u.email || "",
          name: prev.name || u.displayName || (u.email?.split("@")[0] || ""),
          profile: {
            // keep anything that might already exist, otherwise sane defaults
            sector: prev.profile?.sector || "",
            size: prev.profile?.size || "",
            country: prev.profile?.country || "",
            turnover: prev.profile?.turnover || "",
            csrd: prev.profile?.csrd || "Unsure",
            goal: prev.profile?.goal || "compliance",
            timeline: prev.profile?.timeline || "6-12",
          },
          settings: {
            remindAssessments:
              typeof prev.settings?.remindAssessments === "boolean"
                ? prev.settings.remindAssessments
                : false,
          },
          onboardingCompleted: true,
          createdAt: prev.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ After skip, just send them to the dashboard
      // New Assessment / Improve Score buttons should handle "missing sector"
      // by redirecting to onboarding/profile if needed.
      navigate("/dashboard", { replace: true });
    } catch (e) {
      console.error(e);
      setErr(e.message || "Errore durante il salvataggio.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing" style={{ alignItems: "center" }}>
      <main className="landing__main" style={{ maxWidth: 680 }}>
        <h1 className="landing__title">Tell us about your company</h1>
        <p className="landing__subtitle">We’ll personalize your ESG journey.</p>

        {/* Stepper */}
        <div className="stepper">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`stepper__seg ${n <= step ? "is-active" : ""}`}
            />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <section>
            <h2 className="landing__subtitle" style={{ marginBottom: 8 }}>
              Basics
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Sector</label>
                <Select
                  value={form.sector}
                  onChange={(e) => update("sector", e.target.value)}
                >
                  <option value="">Select…</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label style={labelStyle}>Company size</label>
                <Select
                  value={form.size}
                  onChange={(e) => update("size", e.target.value)}
                >
                  <option value="">Select…</option>
                  {sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div style={actionsRow}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={skipForNow}
                disabled={busy}
              >
                Skip for now
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep(2)}
                disabled={!canNext1}
              >
                Next
              </button>
            </div>
          </section>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <section>
            <h2 className="landing__subtitle" style={{ marginBottom: 8 }}>
              Regulatory context
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Country/Region</label>
                <input
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  style={inputStyle}
                  placeholder="Italy / EU"
                />
              </div>

              <div>
                <label style={labelStyle}>Turnover band</label>
                <Select
                  value={form.turnover}
                  onChange={(e) => update("turnover", e.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="<10m">&lt; €10m</option>
                  <option value="10-40m">€10–40m</option>
                  <option value=">40m">&gt; €40m</option>
                </Select>
              </div>

              <div>
                <label style={labelStyle}>CSRD applicability</label>
                <Select
                  value={form.csrd}
                  onChange={(e) => update("csrd", e.target.value)}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Unsure">Unsure</option>
                </Select>
              </div>
            </div>

            <div style={actionsRow}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep(3)}
                disabled={!canNext2}
              >
                Next
              </button>
            </div>
          </section>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <section>
            <h2 className="landing__subtitle" style={{ marginBottom: 8 }}>
              Focus
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Main goal</label>
                <Select
                  value={form.goal}
                  onChange={(e) => update("goal", e.target.value)}
                >
                  <option value="compliance">Compliance</option>
                  <option value="funding">Funding/Investors</option>
                  <option value="brand">Brand & Market</option>
                  <option value="supply">Supply-chain</option>
                </Select>
              </div>

              <div>
                <label style={labelStyle}>Timeline</label>
                <Select
                  value={form.timeline}
                  onChange={(e) => update("timeline", e.target.value)}
                >
                  <option value="0-6">0–6 months</option>
                  <option value="6-12">6–12 months</option>
                  <option value="12+">12+ months</option>
                </Select>
              </div>
            </div>

            <div style={actionsRow}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn--primary"
                onClick={finish}
                disabled={busy}
              >
                {busy ? "Saving…" : "Finish"}
              </button>
            </div>
          </section>
        )}

        {err && (
          <p style={{ color: "#b91c1c", marginTop: 12, fontSize: 14 }}>
            {err}
          </p>
        )}
      </main>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 13,
  marginBottom: 6,
  color: "#334155",
};
const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  marginTop: 2,
};
const actionsRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 16,
};




