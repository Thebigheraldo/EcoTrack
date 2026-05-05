// src/pages/HomePage.js
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import Landing from "../components/Landing";
import "../components/landing.css";

const LEGAL_LINKS = [
  { to: "/terms-and-conditions", label: "Terms of Use" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/cookie-policy", label: "Cookie Policy" },
  { to: "/dpa", label: "DPA" },
  { to: "/legal-notice", label: "Legal Notice" },
];

function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      <Landing
        onLogin={() => navigate("/login")}
        onSignup={() => navigate("/pricing")}
      />

      <HomeLegalFooter />
    </div>
  );
}

function HomeLegalFooter() {
  return (
    <footer
      style={{
        marginTop: "3rem",
        paddingTop: "1.5rem",
        paddingBottom: "1.5rem",
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
          lineHeight: 1.8,
          paddingInline: 16,
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

export default HomePage;