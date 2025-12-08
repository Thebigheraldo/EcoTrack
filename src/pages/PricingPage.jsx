// src/pages/PricingPage.jsx
import React from "react";
import TopNav from "../components/TopNav";
import "../components/landing.css";
import { useNavigate } from "react-router-dom";

export default function PricingPage() {
  const navigate = useNavigate();

  const handleGoToCheckout = () => {
    navigate("/checkout");
  };

  return (
    <div className="landing eco-landing-root">
      <TopNav />

      <main className="eco-landing-main">
        <section className="eco-section eco-fade-in">
          <h1 className="eco-section-title">EcoTrack subscription</h1>
          <p className="eco-section-subtitle">
            EcoTrack is currently offered as a single, simple plan designed
            for small and medium businesses that want a clear ESG self-assessment.
          </p>

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gap: 20,
              maxWidth: 640,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                boxShadow: "0 14px 40px rgba(15,23,42,0.06)",
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#6b7280",
                      marginBottom: 2,
                    }}
                  >
                    Annual plan
                  </p>
                  <h2
                    style={{
                      fontSize: 22,
                      margin: 0,
                      color: "#0f172a",
                    }}
                  >
                    99,99 € / year
                  </h2>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  ✔ Unlimited assessments for one company
                </p>
              </div>

              <ul
                style={{
                  fontSize: 13,
                  color: "#4b5563",
                  paddingLeft: 18,
                  margin: "8px 0 14px",
                }}
              >
                <li>Access to all ESG questionnaires (by sector).</li>
                <li>Dashboard with E / S / G pillar scores and maturity level.</li>
                <li>Top weaknesses and tailored suggestions for improvement.</li>
                <li>Downloadable PDF report for each assessment.</li>
              </ul>

              <p
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 12,
                }}
              >
                Future updates and improvements to EcoTrack will be included
                in your subscription at no extra cost.
              </p>

              <button
                onClick={handleGoToCheckout}
                className="eco-btn-primary"
              >
                Proceed to payment
              </button>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                maxWidth: 520,
              }}
            >
              <p>
                <strong>Note:</strong> during the beta phase, the next step is a
                simulated payment page. Once Stripe is integrated, this will
                become a real checkout experience.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

