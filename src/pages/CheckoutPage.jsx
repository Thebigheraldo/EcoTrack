import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import "../components/landing.css";
import { auth } from "../firebase";
import { startEcoTrackSubscriptionCheckout } from "../utils/stripePayments";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [acceptedBusinessUse, setAcceptedBusinessUse] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const canProceed = acceptedBusinessUse && acceptedLegal;

  const handleCheckout = async () => {
    setErr("");

    if (!acceptedBusinessUse) {
      setErr(
        "You must confirm that you are purchasing and using EcoTrack for professional/business purposes."
      );
      return;
    }

    if (!acceptedLegal) {
      setErr(
        "You must read and accept the legal documents before proceeding."
      );
      return;
    }

    setBusy(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        setBusy(false);
        navigate("/login", { state: { from: location }, replace: true });
        return;
      }

      await startEcoTrackSubscriptionCheckout();
    } catch (error) {
      console.error("Error starting Stripe checkout:", error);
      setErr("There was a problem starting payment. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="landing eco-landing-root">
      <main className="eco-landing-main">
        <section className="eco-section eco-fade-in">
          <h1 className="eco-section-title">Complete your EcoTrack access</h1>

          <p className="eco-section-subtitle">
            Your account has been created. Complete payment to start using
            EcoTrack.
          </p>

          <div
            style={{
              marginTop: 24,
              maxWidth: 680,
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              boxShadow: "0 14px 40px rgba(15,23,42,0.06)",
              padding: 20,
            }}
          >
            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
              <strong>EcoTrack annual plan:</strong> €99.90 / year
            </p>

            <div
              style={{
                marginTop: 16,
                marginBottom: 16,
                padding: 14,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#f9fafb",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#374151",
                  cursor: "pointer",
                  marginBottom: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptedBusinessUse}
                  onChange={(e) => setAcceptedBusinessUse(e.target.checked)}
                  style={{ marginTop: 4 }}
                />

                <span>
                  I confirm that I am purchasing and using EcoTrack for
                  professional/business purposes and not as a private consumer.
                  I also confirm that I am authorised to act on behalf of the
                  business, organisation, or professional activity using
                  EcoTrack.
                </span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(e) => setAcceptedLegal(e.target.checked)}
                  style={{ marginTop: 4 }}
                />

                <span>
                  I confirm that I have read and accept the{" "}
                  <Link
                    to="/terms-and-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms and Conditions
                  </Link>
                  ,{" "}
                  <Link
                    to="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                  ,{" "}
                  <Link
                    to="/cookie-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cookie Policy
                  </Link>
                  ,{" "}
                  <Link
                    to="/dpa"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Data Processing Agreement
                  </Link>
                  ,{" "}
                  <Link
                    to="/refund-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Refund Policy
                  </Link>
                  , and{" "}
                  <Link
                    to="/legal-notice"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Legal Notice
                  </Link>
                  .
                </span>
              </label>
            </div>

            {err && (
              <p style={{ color: "#b91c1c", marginBottom: 12, fontSize: 13 }}>
                {err}
              </p>
            )}

            <button
              type="button"
              onClick={handleCheckout}
              className="eco-btn-primary"
              disabled={busy || !canProceed}
              style={{
                opacity: busy || !canProceed ? 0.7 : 1,
                cursor: busy || !canProceed ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Redirecting..." : "Pay and start"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}