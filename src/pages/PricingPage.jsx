// src/pages/PricingPage.jsx
import React from "react";
import "../components/landing.css";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { auth } from "../firebase";

const LEGAL_LINKS = [
  { to: "/terms-and-conditions", label: "Terms of Use" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/cookie-policy", label: "Cookie Policy" },
  { to: "/dpa", label: "DPA" },
  { to: "/legal-notice", label: "Legal Notice" },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoToCheckout = () => {
    const user = auth.currentUser;

    // Always save destination (checkout) so after signup/login we return here
    const redirectTo = { from: { pathname: "/checkout" } };

    if (!user) {
      // New user: create account first
      navigate("/signup", { state: redirectTo, replace: true });
      return;
    }

    // Logged in: go to checkout
    navigate("/checkout", { state: { from: location }, replace: true });
  };

  return (
    <div className="landing eco-landing-root">
      <main className="eco-landing-main">
        <section className="eco-section eco-fade-in">
          <h1 className="eco-section-title">EcoTrack subscription</h1>

          <p className="eco-section-subtitle">
            EcoTrack is currently offered as a single, simple plan designed for
            small and medium businesses that want a clear ESG self-assessment.
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
                <li>Access to all ESG questionnaires by sector.</li>
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
                Future updates and improvements to EcoTrack will be included in
                your subscription at no extra cost.
              </p>

              <button onClick={handleGoToCheckout} className="eco-btn-primary">
                Proceed to payment
              </button>

              <p style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
                Already have an account?{" "}
                <Link
                  to="/login"
                  state={{ from: { pathname: "/checkout" } }}
                  style={{ color: "#059669", textDecoration: "underline" }}
                >
                  Log in
                </Link>
              </p>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                maxWidth: 560,
                lineHeight: 1.6,
              }}
            >
              <p>
                <strong>Note:</strong> during the beta phase, the next step is a
                simulated payment page. Once Stripe is integrated, this will
                become a real checkout experience.
              </p>

              <p>
                By proceeding, users will be asked to review and accept the
                applicable legal documents before accessing the checkout.
              </p>
            </div>
          </div>
        </section>

        <PricingLegalFooter />
      </main>
    </div>
  );
}

function PricingLegalFooter() {
  return (
    <footer
      style={{
        marginTop: "3rem",
        paddingTop: "1.5rem",
        paddingBottom: "1rem",
        borderTop: "1px solid #e5e7eb",
        textAlign: "center",
        fontSize: "0.85rem",
        color: "#64748b",
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          color: "#64748b",
        }}
      >
        Legal documents
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.85rem",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {LEGAL_LINKS.map((item, index) => (
          <React.Fragment key={item.to}>
            <Link
              to={item.to}
              style={{
                color: "#148A58",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {item.label}
            </Link>

            {index < LEGAL_LINKS.length - 1 && (
              <span style={{ color: "#CBD5E1" }}>•</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </footer>
  );
}