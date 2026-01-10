// src/pages/CheckoutPage.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../components/landing.css";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleActivate = async () => {
    setErr("");
    setBusy(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        // preserve return path so after login user can come back here
        navigate("/login", { state: { from: location }, replace: true });
        return;
      }

      const ref = doc(db, "users", user.uid);

      // 🔐 Fake payment: activate subscription from the client (beta only)
      await setDoc(
        ref,
        {
          subscriptionStatus: "active",
          subscriptionPlan: "annual_99_beta",
          subscriptionUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      navigate("/dashboard");
    } catch (error) {
      console.error("Error activating subscription:", error);
      setErr(
        error?.message ||
          "There was a problem activating your subscription. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing eco-landing-root">
      <main className="eco-landing-main">
        <section className="eco-section eco-fade-in">
          <h1 className="eco-section-title">Complete your EcoTrack access</h1>
          <p className="eco-section-subtitle">
            This page will later be connected to a secure payment provider
            (Stripe). During the beta phase, you can activate access without
            real payment.
          </p>

          <div
            style={{
              marginTop: 24,
              maxWidth: 640,
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              boxShadow: "0 14px 40px rgba(15,23,42,0.06)",
              padding: 20,
            }}
          >
            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
              <strong>Future behaviour:</strong> this step will redirect you to
              a Stripe checkout page to pay <strong>99,99 € / year</strong> for
              your EcoTrack subscription. After successful payment, you will be
              sent back here and your subscription will be activated automatically.
            </p>

            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
              <strong>Current beta behaviour:</strong> click the button below to
              activate your access and continue using EcoTrack without payment.
            </p>

            {err && (
              <p style={{ color: "#b91c1c", marginBottom: 8, fontSize: 13 }}>
                {err}
              </p>
            )}

            <button
              type="button"
              onClick={handleActivate}
              className="eco-btn-primary"
              disabled={busy}
            >
              {busy ? "Activating…" : "Activate beta access and continue"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
