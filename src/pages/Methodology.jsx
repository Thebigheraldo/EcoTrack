// src/pages/Methodology.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../components/landing.css";

const sections = [
  { id: "what-ecotrack-measures", label: "1. What EcoTrack measures" },
  { id: "from-answers-to-scores", label: "2. From answers to numeric scores" },
  { id: "pillar-scores", label: "3. Pillar scores (E, S and G)" },
  { id: "sector-weighting", label: "4. Sector-specific weighting & overall ESG score" },
  { id: "rating-bands", label: "5. Rating bands" },
  { id: "benchmarks-thresholds", label: "6. Benchmarks & critical thresholds" },
  { id: "using-results", label: "7. How to use EcoTrack results" },
  { id: "benchmarking-method", label: "8. How benchmarking is calculated" },
  { id: "faq", label: "9. FAQ" },
  { id: "disclaimer", label: "10. Disclaimer & limitations" },
];

function InPageNav({ isMobile }) {
  const handleClick = (id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <nav
      className="methodology-nav"
      style={{
        position: "sticky",
        top: 80,
        zIndex: 1,
        margin: "8px 0 16px",
        background: "#F8FAFC",
        borderRadius: 9999,
        padding: isMobile ? 8 : 12,
        overflowX: "auto",
        whiteSpace: "nowrap",
      }}
    >
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => handleClick(s.id)}
          className="pill-button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: 9999,
            border: "1px solid #E2E8F0",
            fontSize: 12,
            marginRight: 8,
            background: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

function MethodologySection({ id, title, children, isMobile, defaultOpen = true }) {
  // desktop: open by default, mobile: closed by default
  const [open, setOpen] = useState(!isMobile && defaultOpen);

  useEffect(() => {
    setOpen(!isMobile && defaultOpen);
  }, [isMobile, defaultOpen]);

  const cardStyle = {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #E2E8F0",
    background: "#FFFFFF",
    boxShadow: "0 6px 20px rgba(16,24,40,.06)",
    scrollMarginTop: 96, // for sticky header offset when using scrollIntoView
  };

  return (
    <section id={id} className="card" style={cardStyle}>
      <button
        type="button"
        onClick={() => isMobile && setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: isMobile ? "pointer" : "default",
        }}
      >
        <h2 style={{ marginBottom: isMobile ? 0 : 8 }}>{title}</h2>
        {isMobile && (
          <span
            aria-hidden="true"
            style={{
              marginLeft: 8,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            {open ? "▴" : "▾"}
          </span>
        )}
      </button>

      {(!isMobile || open) && (
        <div style={{ marginTop: isMobile ? 8 : 12 }}>{children}</div>
      )}
    </section>
  );
}

const Methodology = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768);
    };

    const handleScroll = () => {
      if (typeof window === "undefined") return;
      setShowBackToTop(window.scrollY > 400);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="landing" style={{ alignItems: "stretch" }}>
      <TopNav />

      <main
        className="landing__main"
        style={{
          maxWidth: 1200,
          width: "100%",
          paddingTop: 80,
        }}
      >
        <div
          className="page-container methodology-page"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Header */}
          <header
            className="page-header"
            style={{
              marginBottom: 8,
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 9999,
                  background: "#E0F2FE",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.04,
                  color: "#0F172A",
                }}
              >
                Methodology
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 9999,
                  background: "#F1F5F9",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#0F172A",
                }}
              >
                E = Environmental • S = Social • G = Governance
              </span>
            </div>

            <h1
              className="page-title"
              style={{
                fontSize: isMobile ? 24 : 28,
                marginBottom: 4,
              }}
            >
              EcoTrack Methodology
            </h1>
            <p
              className="page-subtitle"
              style={{
                maxWidth: 720,
                fontSize: isMobile ? 14 : 16,
              }}
            >
              How your ESG score is calculated and what your rating really means.
            </p>
            <p
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#64748B",
              }}
            >
              Last updated: October 2025
            </p>
          </header>

          {/* At a glance summary + CTA */}
          <div
            className="card"
            style={{
              padding: 16,
              borderRadius: 16,
              border: "1px solid #BBF7D0",
              background: "#ECFDF3",
              boxShadow: "0 4px 12px rgba(16,24,40,.04)",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 12,
              alignItems: isMobile ? "flex-start" : "center",
            }}
          >
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>Methodology at a glance</h2>
              <ul
                style={{
                  fontSize: 14,
                  marginLeft: 18,
                  marginBottom: 4,
                }}
              >
                <li>Questionnaire → 0–100 score per pillar (E, S, G).</li>
                <li>Sector-specific weights → overall ESG score and rating band.</li>
                <li>Benchmarks & thresholds → understand where you stand vs peers.</li>
              </ul>
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                Use this page as a reference when interpreting your results.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              style={{
                padding: "10px 16px",
                borderRadius: 9999,
                border: "none",
                background: "#148A58",
                color: "#FFFFFF",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: 14,
              }}
            >
              View my latest results
            </button>
          </div>

          {/* In-page navigation */}
          <InPageNav isMobile={isMobile} />

          {/* 1. What EcoTrack measures */}
          <MethodologySection
            id="what-ecotrack-measures"
            title="1. What EcoTrack measures"
            isMobile={isMobile}
          >
            <p>
              EcoTrack is a <strong>self-assessment tool</strong> that evaluates how
              your company manages Environmental, Social and Governance (ESG)
              topics. The questionnaire is adapted to your sector and grouped into
              three main pillars:
            </p>
            <ul>
              <li>
                <strong>Environmental (E)</strong> – energy, emissions, water,
                waste, resources.
              </li>
              <li>
                <strong>Social (S)</strong> – workers&apos; rights, health &amp;
                safety, diversity &amp; inclusion, community.
              </li>
              <li>
                <strong>Governance (G)</strong> – policies, risk management,
                compliance, transparency.
              </li>
            </ul>
            <p>
              Each question represents a specific practice (policy, process, metric
              or behaviour) that supports your ESG performance.
            </p>
          </MethodologySection>

          {/* 2. From answers to numeric scores */}
          <MethodologySection
            id="from-answers-to-scores"
            title="2. From answers to numeric scores"
            isMobile={isMobile}
          >
            <p>
              For every question, you choose the option that best describes your
              current situation. EcoTrack converts each option into a{" "}
              <strong>score between 0 and 100</strong>.
            </p>

            <div
              className="table-wrapper"
              style={{
                marginTop: 12,
                marginBottom: 12,
                overflowX: "auto",
              }}
            >
              <table
                className="info-table"
                style={{
                  width: "100%",
                  minWidth: 480,
                  borderCollapse: "collapse",
                }}
              >
                <caption
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    color: "#64748B",
                    marginBottom: 4,
                  }}
                >
                  Mapping of answer options to numeric scores (0–100).
                </caption>
                <thead>
                  <tr>
                    <th>Answer option</th>
                    <th>Meaning</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Not in place / No action</td>
                    <td>No policy, process or evidence in place yet.</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Initial / Informal</td>
                    <td>
                      Some informal practices or ad hoc actions, but not structured
                      or documented.
                    </td>
                    <td>25</td>
                  </tr>
                  <tr>
                    <td>Basic / Partially implemented</td>
                    <td>
                      Policy or process exists, applied in part of the organisation.
                    </td>
                    <td>50</td>
                  </tr>
                  <tr>
                    <td>Advanced / Systematic</td>
                    <td>
                      Structured and documented practice, applied consistently and
                      monitored.
                    </td>
                    <td>75</td>
                  </tr>
                  <tr>
                    <td>Leading practice</td>
                    <td>
                      Fully integrated in strategy, measured with KPIs and regularly
                      improved.
                    </td>
                    <td>100</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="note">
              <strong>Note:</strong> In some cases, &quot;Not applicable&quot; is
              excluded from the calculation, so it does not penalise your score.
            </p>
          </MethodologySection>

          {/* 3. Pillar scores (E, S, G) */}
          <MethodologySection
            id="pillar-scores"
            title="3. Pillar scores (E, S and G)"
            isMobile={isMobile}
          >
            <p>
              For each pillar, EcoTrack calculates a{" "}
              <strong>simple average of all relevant questions</strong>.
            </p>
            <ul>
              <li>
                <strong>Environmental score (E)</strong> = average of all
                Environmental questions.
              </li>
              <li>
                <strong>Social score (S)</strong> = average of all Social questions.
              </li>
              <li>
                <strong>Governance score (G)</strong> = average of all Governance
                questions.
              </li>
            </ul>
            <p>
              This gives you a value between <strong>0 and 100</strong> for each
              pillar, allowing you to see where you are stronger or weaker.
            </p>
          </MethodologySection>

          {/* 4. Sector-specific weighting and overall ESG score */}
          <MethodologySection
            id="sector-weighting"
            title="4. Sector-specific weighting and overall ESG score"
            isMobile={isMobile}
          >
            <p>
              The overall ESG score is a <strong>weighted average</strong> of the
              three pillar scores. The weights depend on your sector and reflect the
              relative importance of E, S and G risks and opportunities.
            </p>

            <p><strong>Overall score formula:</strong></p>
            <pre
              className="formula-block"
              style={{
                padding: 8,
                borderRadius: 8,
                background: "#F1F5N9".replace("N", "9"), // avoid typo, but keep style
                overflowX: "auto",
                color: "#0f172a",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
{`Overall ESG score = (E × wE) + (S × wS) + (G × wG)`}
            </pre>

            <ul>
              <li>
                <strong>E, S, G</strong> = your Environmental, Social and Governance
                scores (0–100).
              </li>
              <li>
                <strong>wE, wS, wG</strong> = weights that sum to 100% and change by
                sector (for example, manufacturing gives more weight to
                Environmental topics; finance may give more weight to Governance).
              </li>
            </ul>

            <p>
              The sector weights used in EcoTrack are defined in the application and
              may be updated over time. The current weights are shown in the
              details/tooltip section of your results.
            </p>
          </MethodologySection>

          {/* 5. Rating bands */}
          <MethodologySection
            id="rating-bands"
            title="5. Rating bands"
            isMobile={isMobile}
          >
            <p>
              Your overall ESG score is translated into a{" "}
              <strong>qualitative rating</strong> to make interpretation easier.
            </p>

            <div
              className="table-wrapper"
              style={{
                marginTop: 12,
                marginBottom: 12,
                overflowX: "auto",
              }}
            >
              <table
                className="info-table"
                style={{
                  width: "100%",
                  minWidth: 520,
                  borderCollapse: "collapse",
                }}
              >
                <caption
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    color: "#64748B",
                    marginBottom: 4,
                  }}
                >
                  Rating bands used to interpret the overall ESG score.
                </caption>
                <thead>
                  <tr>
                    <th>Score range</th>
                    <th>Rating</th>
                    <th>Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>0 – 20</td>
                    <td>Critical</td>
                    <td>
                      ESG management is largely absent. High exposure to regulatory,
                      market and reputational risks.
                    </td>
                  </tr>
                  <tr>
                    <td>21 – 40</td>
                    <td>High risk</td>
                    <td>
                      Some initiatives exist but are fragmented and not integrated
                      in strategy.
                    </td>
                  </tr>
                  <tr>
                    <td>41 – 60</td>
                    <td>Basic</td>
                    <td>
                      ESG foundations are in place but coverage and implementation
                      are still partial.
                    </td>
                  </tr>
                  <tr>
                    <td>61 – 80</td>
                    <td>Advanced</td>
                    <td>
                      Structured ESG approach with clear policies, metrics and
                      responsibilities.
                    </td>
                  </tr>
                  <tr>
                    <td>81 – 100</td>
                    <td>Leader</td>
                    <td>
                      ESG is embedded in strategy and operations with continuous
                      improvement and innovation.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="note">
              <strong>Important:</strong> EcoTrack is not a certification, but a{" "}
              decision-support tool to identify gaps and prioritise actions.
            </p>
          </MethodologySection>

          {/* 6. Benchmarks and critical thresholds */}
          <MethodologySection
            id="benchmarks-thresholds"
            title="6. Benchmarks and critical thresholds"
            isMobile={isMobile}
          >
            <p>
              On the results page, your scores are also compared with{" "}
              <strong>sector benchmarks</strong> (shown for example as{" "}
              <em>peer median</em> or <em>sector baseline</em>) to give you a sense
              of how you perform versus peers.
            </p>
            <p>
              EcoTrack also applies <strong>critical thresholds</strong>. For
              example, if any pillar (E, S, or G) is{" "}
              <strong>20% or lower</strong>:
            </p>
            <ul>
              <li>the overall score may be hidden, and</li>
              <li>
                you see a message encouraging you to review your ESG strategy before
                focusing on the aggregated score.
              </li>
            </ul>
            <p>
              This prevents a single strong area from masking severe weaknesses in
              another pillar (for example, good Environmental performance but
              critical Governance issues).
            </p>
          </MethodologySection>

          {/* 7. How to use the results */}
          <MethodologySection
            id="using-results"
            title="7. How to use EcoTrack results"
            isMobile={isMobile}
          >
            <ul>
              <li>
                Use the <strong>pillar breakdown</strong> to quickly see where your
                main gaps are.
              </li>
              <li>
                Look at the <strong>question-level results</strong> to identify
                concrete actions.
              </li>
              <li>
                Combine the score with <strong>tailored suggestions</strong> to
                build your improvement roadmap.
              </li>
              <li>
                Repeat the assessment periodically to track{" "}
                <strong>progress over time</strong>.
              </li>
            </ul>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
              Tip: after updating a few key practices, run the assessment again to
              see how much your ESG maturity has improved.
            </p>
          </MethodologySection>

          {/* 8. How benchmarking is calculated */}
          <MethodologySection
            id="benchmarking-method"
            title="8. How benchmarking is calculated"
            isMobile={isMobile}
          >
            <p>
              Benchmarking in EcoTrack means comparing your ESG performance to{" "}
              <strong>fixed baseline values defined for your sector</strong>. These
              baselines are stored directly in the application (for each sector and
              for each pillar: E, S and G) and used consistently across all
              assessments.
            </p>
            <p>For each sector, EcoTrack defines three baselines:</p>
            <ul>
              <li>
                a <strong>baseline Environmental score</strong>,
              </li>
              <li>
                a <strong>baseline Social score</strong>, and
              </li>
              <li>
                a <strong>baseline Governance score</strong>.
              </li>
            </ul>
            <p>
              These values represent an <strong>indicative average maturity</strong>{" "}
              for a typical SME in that industry, based on observed ESG practices,
              common weaknesses and typical regulatory expectations. They are not
              pulled in real time from external databases.
            </p>
            <p>
              On the results page, EcoTrack calculates the gap for each pillar as:
            </p>
            <pre
              className="formula-block"
              style={{
                padding: 8,
                borderRadius: 8,
                background: "#F1F5F9",
                overflowX: "auto",
                color: "#0f172a",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
{`Gap (per pillar) = Your pillar score – Sector baseline (same pillar)`}
            </pre>
            <p>
              This gap is then interpreted and visualised (for example, in the peer
              comparison chart) as:
            </p>
            <ul>
              <li>
                <strong>Above benchmark</strong> – your score is higher than the
                sector baseline.
              </li>
              <li>
                <strong>In line with benchmark</strong> – your score is close to the
                baseline.
              </li>
              <li>
                <strong>Below benchmark</strong> – your score is lower than the
                typical value for your sector.
              </li>
            </ul>
            <p>
              The objective is not to provide a formal market ranking, but to give a{" "}
              <strong>clear, consistent reference point</strong> to orient your ESG
              priorities and understand whether your performance is lagging or
              leading compared to a typical peer.
            </p>
          </MethodologySection>

          {/* 9. FAQ */}
          <MethodologySection
            id="faq"
            title="9. FAQ"
            isMobile={isMobile}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  1. Is EcoTrack an official ESG rating or certification?
                </h3>
                <p style={{ fontSize: 14 }}>
                  No. EcoTrack is a <strong>self-assessment tool</strong>, not a third-party rating
                  or certification. It helps you understand your ESG maturity and identify areas
                  for improvement.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  2. Can EcoTrack be used for CSRD reporting?
                </h3>
                <p style={{ fontSize: 14 }}>
                  EcoTrack supports <strong>awareness and readiness</strong>, but it is{" "}
                  <strong>not</strong> a substitute for CSRD-compliant reporting, external
                  assurance or professional audit. It highlights gaps and priorities, but does not
                  generate a CSRD-aligned sustainability statement.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  3. How often should my company repeat the assessment?
                </h3>
                <p style={{ fontSize: 14 }}>
                  Most SMEs repeat the assessment every <strong>3–6 months</strong> or after major
                  improvements (policies, data systems, governance updates). EcoTrack is designed
                  to track your progress over time.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  4. Are my answers verified or audited?
                </h3>
                <p style={{ fontSize: 14 }}>
                  No. EcoTrack does <strong>not</strong> verify evidence or documentation. Your
                  results depend entirely on the <strong>accuracy and honesty</strong> of the
                  information you provide.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  5. Can multiple people in my company take the assessment?
                </h3>
                <p style={{ fontSize: 14 }}>
                  Yes. Anyone with access to your company account can take the assessment. Results
                  appear chronologically on your dashboard so you can track company-wide progress.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  6. Why is my overall score sometimes hidden?
                </h3>
                <p style={{ fontSize: 14 }}>
                  If any pillar (E, S or G) scores <strong>20% or below</strong>, EcoTrack may hide
                  the overall score to prevent a single strong area from masking{" "}
                  <strong>critical weaknesses</strong>. This ensures a realistic understanding of
                  ESG risk exposure.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  7. Where do the benchmark values come from?
                </h3>
                <p style={{ fontSize: 14 }}>
                  Benchmark values are <strong>sector baselines defined inside the EcoTrack
                  model</strong>, based on typical SME practices and expected ESG maturity. They
                  are <strong>indicative</strong>, not real-time industry averages or external
                  ratings.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                  8. What if I have a question that is not answered here?
                </h3>
                <p style={{ fontSize: 14 }}>
                  You can always reach us directly at:{" "}
                  <a href="mailto:info@viridisconsultancy.com">
                    info@viridisconsultancy.com
                  </a>
                  . We&apos;ll assist you personally.
                </p>
              </div>
            </div>
          </MethodologySection>

          {/* 10. Disclaimer & limitations */}
          <MethodologySection
            id="disclaimer"
            title="10. Disclaimer & limitations"
            isMobile={isMobile}
          >
            <div
              style={{
                borderLeft: "4px solid #F97316",
                background: "#FFF7ED",
                padding: 12,
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 14,
              }}
            >
              <strong>Important:</strong> EcoTrack is a self-assessment tool and not
              a formal ESG rating or certification.
            </div>

            <p>
              EcoTrack is a <strong>self-assessment and awareness tool</strong>. It
              is designed to help you understand your ESG maturity level, identify
              gaps and structure an improvement roadmap.
            </p>
            <ul>
              <li>
                <strong>No audit or assurance:</strong> EcoTrack does not replace an
                independent ESG audit, financial due diligence or legal advice.
              </li>
              <li>
                <strong>User responsibility:</strong> All results depend on the
                accuracy and completeness of the information you provide. EcoTrack
                does not verify your answers or supporting evidence.
              </li>
              <li>
                <strong>Indicative benchmarks:</strong> Sector baselines and peer
                comparisons are indicative only. They are defined within the tool
                and may be refined over time. They are{" "}
                <strong>not official ESG ratings</strong>, nor do they represent an
                endorsement or certification.
              </li>
              <li>
                <strong>Updates over time:</strong> Scoring rules, weights and
                benchmark values may change as ESG standards and regulations evolve.
                Assessments taken at different times may therefore not be directly
                comparable.
              </li>
              <li>
                <strong>Use of results:</strong> EcoTrack and Viridis Consulting are
                not liable for business, investment or strategic decisions taken
                solely on the basis of this assessment. Always combine EcoTrack
                results with professional advice and internal analysis.
              </li>
            </ul>
            <p>
              By using EcoTrack, you acknowledge these limitations and accept that
              the tool is intended as a{" "}
              <strong>decision-support and learning instrument</strong>, not as a
              formal ESG rating or certification.
            </p>
          </MethodologySection>
        </div>
      </main>

      {/* Back to top button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={handleBackToTop}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            padding: "8px 12px",
            borderRadius: 9999,
            border: "1px solid #CBD5F5",
            background: "#FFFFFF",
            boxShadow: "0 8px 20px rgba(15,23,42,0.18)",
            fontSize: 12,
            cursor: "pointer",
            zIndex: 20,
          }}
        >
          ↑ Back to top
        </button>
      )}
    </div>
  );
};

export default Methodology;





