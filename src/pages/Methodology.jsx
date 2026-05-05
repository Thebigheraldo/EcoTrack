// src/pages/Methodology.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../components/landing.css";

const CRITICAL_PILLAR_THRESHOLD = 20;

const ANSWER_SCALE = [
  {
    label: "Not in place",
    score: 0,
    description:
      "No formal practice, process, policy, or evidence is currently in place.",
  },
  {
    label: "Informal / ad hoc",
    score: 25,
    description:
      "Some actions exist, but they are informal, inconsistent, or not documented.",
  },
  {
    label: "Partially structured",
    score: 50,
    description:
      "A process exists, but it is incomplete, partial, or not regularly reviewed.",
  },
  {
    label: "Implemented and documented",
    score: 75,
    description:
      "A clear practice exists, is implemented, and has supporting documentation.",
  },
  {
    label: "Advanced / best practice",
    score: 100,
    description:
      "The practice is mature, monitored, and continuously improved.",
  },
];

const SECTOR_WEIGHTS = {
  manufacturing: {
    E: 45,
    S: 30,
    G: 25,
  },
  agriculture_food: {
    E: 45,
    S: 35,
    G: 20,
  },
  textile_fashion: {
    E: 40,
    S: 35,
    G: 25,
  },
  tech: {
    E: 30,
    S: 35,
    G: 35,
  },
  finance: {
    E: 20,
    S: 35,
    G: 45,
  },
  construction: {
    E: 45,
    S: 30,
    G: 25,
  },
  furniture: {
    E: 40,
    S: 30,
    G: 30,
  },
  transportation: {
    E: 50,
    S: 25,
    G: 25,
  },
  default: {
    E: 34,
    S: 33,
    G: 33,
  },
};

const sections = [
  { id: "what-ecotrack-measures", label: "1. What EcoTrack measures" },
  { id: "maturity-scale", label: "2. Answer scoring scale" },
  { id: "pillar-scores", label: "3. ESG pillar scores" },
  { id: "sector-weighting", label: "4. Sector weighting" },
  { id: "maturity-bands", label: "5. Maturity bands" },
  { id: "benchmarks-thresholds", label: "6. Benchmarks & thresholds" },
  { id: "using-results", label: "7. How to use results" },
  { id: "benchmarking-method", label: "8. Benchmarking method" },
  { id: "faq", label: "9. FAQ" },
  { id: "disclaimer", label: "10. Disclaimer" },
];

const pillarLabels = {
  E: "Environmental",
  S: "Social",
  G: "Governance",
};

const sectorLabels = {
  manufacturing: "Manufacturing",
  agriculture_food: "Agriculture / Food",
  textile_fashion: "Textile / Fashion",
  tech: "Technology",
  finance: "Finance",
  construction: "Construction",
  furniture: "Furniture",
  transportation: "Transportation",
  default: "Default / fallback",
};

const maturityBands = [
  {
    range: "0–20",
    label: "Critical",
    meaning:
      "ESG practices are largely absent or highly fragmented. Immediate attention is required.",
  },
  {
    range: "21–40",
    label: "High risk",
    meaning:
      "Some actions exist, but the approach is still weak, inconsistent, or insufficiently documented.",
  },
  {
    range: "41–60",
    label: "Basic",
    meaning:
      "Core ESG foundations are present, but implementation, monitoring, or coverage remains partial.",
  },
  {
    range: "61–80",
    label: "Advanced",
    meaning:
      "Structured ESG practices are in place, supported by policies, responsibilities, and documentation.",
  },
  {
    range: "81–100",
    label: "Leader",
    meaning:
      "ESG is strongly integrated into operations and improvement is actively monitored.",
  },
];

const styles = {
  card: {
    padding: 18,
    borderRadius: 18,
    border: "1px solid #E2E8F0",
    background: "#FFFFFF",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  softCard: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #D9F99D",
    background: "linear-gradient(135deg, #F0FDF4 0%, #ECFEFF 100%)",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },
  muted: {
    color: "#64748B",
  },
  small: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 1.6,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #E2E8F0",
    background: "#F8FAFC",
    fontSize: 12,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #EEF2F7",
    fontSize: 14,
    verticalAlign: "top",
  },
  formula: {
    padding: 12,
    borderRadius: 12,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    overflowX: "auto",
    color: "#0F172A",
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.6,
  },
};

function formatWeight(value) {
  const n = Number(value) || 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function getSectorLabel(key) {
  return (
    sectorLabels[key] ||
    String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getDominantPillars(weights) {
  const entries = Object.entries(weights || {}).filter(([pillar]) =>
    ["E", "S", "G"].includes(pillar)
  );

  if (!entries.length) return "—";

  const max = Math.max(...entries.map(([, value]) => formatWeight(value)));

  return entries
    .filter(([, value]) => formatWeight(value) === max)
    .map(([pillar]) => pillarLabels[pillar] || pillar)
    .join(" / ");
}

function getAnswerMeaning(item) {
  if (item.description) return item.description;

  switch (Number(item.score)) {
    case 0:
      return "No formal practice, process, policy, or evidence is currently in place.";
    case 25:
      return "Some actions exist, but they are informal, inconsistent, or not documented.";
    case 50:
      return "A process exists, but it is incomplete, partial, or not regularly reviewed.";
    case 75:
      return "A clear practice exists, is implemented, and has supporting documentation.";
    case 100:
      return "The practice is mature, monitored, and continuously improved.";
    default:
      return "Maturity level used by the EcoTrack scoring model.";
  }
}

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
      aria-label="Methodology sections"
      style={{
        position: "sticky",
        top: 80,
        zIndex: 5,
        margin: "8px 0 16px",
        background: "rgba(248, 250, 252, 0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid #E2E8F0",
        borderRadius: 9999,
        padding: isMobile ? 8 : 10,
        overflowX: "auto",
        whiteSpace: "nowrap",
        boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
      }}
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => handleClick(section.id)}
          className="pill-button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "7px 12px",
            borderRadius: 9999,
            border: "1px solid #E2E8F0",
            fontSize: 12,
            marginRight: 8,
            background: "#FFFFFF",
            color: "#0F172A",
            cursor: "pointer",
          }}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function MethodologySection({
  id,
  title,
  children,
  isMobile,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(!isMobile && defaultOpen);

  useEffect(() => {
    setOpen(!isMobile && defaultOpen);
  }, [isMobile, defaultOpen]);

  return (
    <section
      id={id}
      className="card"
      style={{
        ...styles.card,
        scrollMarginTop: 104,
      }}
    >
      <button
        type="button"
        onClick={() => isMobile && setOpen((value) => !value)}
        aria-expanded={open}
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
        <h2
          style={{
            margin: 0,
            fontSize: isMobile ? 19 : 22,
            letterSpacing: "-0.02em",
            color: "#0F172A",
          }}
        >
          {title}
        </h2>

        {isMobile && (
          <span
            aria-hidden="true"
            style={{
              marginLeft: 8,
              fontSize: 18,
              lineHeight: 1,
              color: "#334155",
            }}
          >
            {open ? "▴" : "▾"}
          </span>
        )}
      </button>

      {(!isMobile || open) && (
        <div
          style={{
            marginTop: isMobile ? 12 : 16,
            color: "#334155",
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function Table({ caption, headers, rows, minWidth = 560 }) {
  return (
    <div
      className="table-wrapper"
      style={{
        marginTop: 12,
        marginBottom: 12,
        overflowX: "auto",
        border: "1px solid #E2E8F0",
        borderRadius: 14,
      }}
    >
      <table
        className="info-table"
        style={{
          width: "100%",
          minWidth,
          borderCollapse: "collapse",
          background: "#FFFFFF",
        }}
      >
        {caption && (
          <caption
            style={{
              textAlign: "left",
              fontSize: 12,
              color: "#64748B",
              padding: "10px 12px",
              captionSide: "top",
            }}
          >
            {caption}
          </caption>
        )}

        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={styles.th}>
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={styles.td}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ tone = "green", title, children }) {
  const tones = {
    green: {
      border: "#BBF7D0",
      background: "#F0FDF4",
      accent: "#148A58",
    },
    orange: {
      border: "#FED7AA",
      background: "#FFF7ED",
      accent: "#F97316",
    },
    blue: {
      border: "#BFDBFE",
      background: "#EFF6FF",
      accent: "#2563EB",
    },
    slate: {
      border: "#CBD5E1",
      background: "#F8FAFC",
      accent: "#475569",
    },
  };

  const selected = tones[tone] || tones.green;

  return (
    <div
      style={{
        border: `1px solid ${selected.border}`,
        borderLeft: `5px solid ${selected.accent}`,
        background: selected.background,
        padding: 14,
        borderRadius: 14,
        marginTop: 12,
        marginBottom: 12,
      }}
    >
      {title && (
        <strong
          style={{
            display: "block",
            marginBottom: 4,
            color: "#0F172A",
          }}
        >
          {title}
        </strong>
      )}
      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

const Methodology = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const navigate = useNavigate();

  const sectorWeightRows = useMemo(() => {
    return Object.entries(SECTOR_WEIGHTS || {}).map(([sectorKey, weights]) => [
      getSectorLabel(sectorKey),
      `${formatWeight(weights.E)}%`,
      `${formatWeight(weights.S)}%`,
      `${formatWeight(weights.G)}%`,
      getDominantPillars(weights),
    ]);
  }, []);

  const answerRows = useMemo(() => {
    return (ANSWER_SCALE || []).map((item) => [
      item.label,
      getAnswerMeaning(item),
      item.score,
    ]);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768);
    };

    const handleScroll = () => {
      if (typeof window === "undefined") return;
      setShowBackToTop(window.scrollY > 420);
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
          <header
            className="page-header"
            style={{
              ...styles.card,
              textAlign: "left",
              background:
                "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 45%, #ECFDF3 100%)",
              padding: isMobile ? 20 : 28,
            }}
          >
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 9999,
                  background: "#DCFCE7",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#14532D",
                }}
              >
                Methodology
              </span>

              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 9999,
                  background: "#F1F5F9",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Environmental • Social • Governance
              </span>
            </div>

            <h1
              className="page-title"
              style={{
                fontSize: isMobile ? 28 : 38,
                lineHeight: 1.1,
                marginBottom: 8,
                letterSpacing: "-0.04em",
                color: "#0F172A",
              }}
            >
              EcoTrack scoring methodology
            </h1>

            <p
              className="page-subtitle"
              style={{
                maxWidth: 780,
                fontSize: isMobile ? 15 : 17,
                color: "#475569",
                lineHeight: 1.7,
                marginBottom: 10,
              }}
            >
              EcoTrack converts ESG self-assessment answers into a{" "}
              <strong>weighted ESG maturity score</strong>. This page explains how
              answers are scored, how pillar scores are calculated, how
              sector-specific weights are applied, and how results should be
              interpreted.
            </p>

            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                margin: 0,
              }}
            >
              Last updated: May 2026
            </p>
          </header>

          <div
            className="card"
            style={{
              ...styles.softCard,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 20,
                  margin: "0 0 8px",
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                }}
              >
                Methodology at a glance
              </h2>

              <ul
                style={{
                  fontSize: 14,
                  marginLeft: 18,
                  marginBottom: 8,
                  color: "#334155",
                  lineHeight: 1.7,
                }}
              >
                <li>Each answer is converted into a 0–100 maturity score.</li>
                <li>
                  Environmental, Social, and Governance pillar scores are
                  calculated separately.
                </li>
                <li>
                  The final result is a weighted ESG maturity score using
                  sector-specific pillar weights.
                </li>
                <li>
                  Any pillar at or below {CRITICAL_PILLAR_THRESHOLD}% is flagged
                  as a critical weakness.
                </li>
              </ul>

              <p style={styles.small}>
                EcoTrack is designed to support decisions and prioritisation. It
                does not certify, audit, or guarantee ESG compliance.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                style={{
                  padding: "12px 16px",
                  borderRadius: 9999,
                  border: "none",
                  background: "#148A58",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontSize: 14,
                  boxShadow: "0 10px 24px rgba(20,138,88,0.22)",
                }}
              >
                View my latest results
              </button>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(148,163,184,0.32)",
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                Recommended label to use across the app:{" "}
                <strong>Weighted ESG maturity score</strong>.
              </div>
            </div>
          </div>

          <InPageNav isMobile={isMobile} />

          <MethodologySection
            id="what-ecotrack-measures"
            title="1. What EcoTrack measures"
            isMobile={isMobile}
          >
            <p>
              EcoTrack is a <strong>self-assessment and decision-support tool</strong>{" "}
              for evaluating how an organisation manages ESG topics. The
              questionnaire is adapted by sector and organised into three ESG
              pillars:
            </p>

            <ul>
              <li>
                <strong>Environmental (E)</strong> — energy, emissions, water,
                waste, materials, circularity, and resource efficiency.
              </li>
              <li>
                <strong>Social (S)</strong> — workers, health and safety, diversity
                and inclusion, human rights, training, and community-related
                practices.
              </li>
              <li>
                <strong>Governance (G)</strong> — policies, responsibilities, risk
                management, ethics, compliance, transparency, and internal controls.
              </li>
            </ul>

            <p>
              Each question represents a specific ESG practice. The score reflects
              the maturity of that practice, not whether the company is formally
              compliant with a law, standard, or reporting framework.
            </p>

            <Callout tone="blue" title="Important distinction">
              EcoTrack measures <strong>ESG maturity</strong>. It does not produce
              an official ESG rating, certification, audit opinion, or compliance
              statement.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="maturity-scale"
            title="2. From answers to numeric maturity scores"
            isMobile={isMobile}
          >
            <p>
              Each questionnaire answer is converted into a numeric score from{" "}
              <strong>0 to 100</strong>. The scale is designed to reflect the
              maturity of the practice: from absent or informal practices to mature,
              documented, and continuously improved processes.
            </p>

            <Table
              caption="Current answer-to-score mapping used by EcoTrack."
              headers={["Answer option", "Meaning", "Score"]}
              rows={answerRows}
              minWidth={640}
            />

            <Callout tone="slate" title="How to interpret the scale">
              A score of 0 does not mean the company has “failed”. It means the
              specific practice is not currently in place. A score of 100 does not
              mean legal compliance is guaranteed. It means the practice appears
              mature within the EcoTrack self-assessment model.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="pillar-scores"
            title="3. ESG pillar scores"
            isMobile={isMobile}
          >
            <p>
              EcoTrack calculates one score for each ESG pillar. Each pillar score
              is based on the questions assigned to that pillar in the selected
              sector questionnaire.
            </p>

            <div style={styles.formula}>
              Environmental score = average score of Environmental questions
              <br />
              Social score = average score of Social questions
              <br />
              Governance score = average score of Governance questions
            </div>

            <p>
              This creates three separate values between <strong>0 and 100</strong>.
              These pillar scores are important because they show whether the
              organisation is balanced or whether one ESG area is materially weaker
              than the others.
            </p>

            <Callout tone="orange" title="Why pillar scores matter">
              A single final score can hide a serious weakness. For example, a
              company may perform reasonably well on Environmental topics but still
              have critical Governance gaps. EcoTrack therefore evaluates each
              pillar separately before interpreting the final result.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="sector-weighting"
            title="4. Sector-specific weighting and weighted ESG maturity score"
            isMobile={isMobile}
          >
            <p>
              The final result is not a simple average of all questions. EcoTrack
              first calculates the Environmental, Social, and Governance pillar
              scores, then combines them using{" "}
              <strong>sector-specific ESG weights</strong>.
            </p>

            <p>
              This is necessary because ESG priorities differ by sector. For
              example, Environmental issues are usually more material in
              manufacturing or transportation, while Governance may carry more
              weight in finance.
            </p>

            <p>
              <strong>Formula:</strong>
            </p>

            <div style={styles.formula}>
              Weighted ESG maturity score = ((E × wE) + (S × wS) + (G × wG)) /
              100
            </div>

            <ul>
              <li>
                <strong>E, S, G</strong> = Environmental, Social, and Governance
                pillar scores.
              </li>
              <li>
                <strong>wE, wS, wG</strong> = sector-specific percentage weights.
              </li>
              <li>The three weights always sum to 100%.</li>
            </ul>

            <Table
              caption="Current sector-specific ESG pillar weights."
              headers={[
                "Sector",
                "Environmental",
                "Social",
                "Governance",
                "Highest emphasis",
              ]}
              rows={sectorWeightRows}
              minWidth={760}
            />

            <Callout tone="green" title="Terminology used in EcoTrack">
              The correct label is{" "}
              <strong>Weighted ESG maturity score</strong>. Avoid calling it a
              compliance score, certification score, sustainability rating, or audit
              result.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="maturity-bands"
            title="5. Maturity bands"
            isMobile={isMobile}
          >
            <p>
              To make results easier to interpret, EcoTrack translates the weighted
              ESG maturity score into a qualitative maturity band.
            </p>

            <Table
              caption="Interpretation bands for the weighted ESG maturity score."
              headers={["Score range", "Band", "Interpretation"]}
              rows={maturityBands.map((band) => [
                band.range,
                band.label,
                band.meaning,
              ])}
              minWidth={700}
            />

            <Callout tone="orange" title="Critical pillar rule comes first">
              If any ESG pillar scores {CRITICAL_PILLAR_THRESHOLD}% or below,
              EcoTrack flags a critical weakness. In that case, the final score
              should not be interpreted as balanced ESG performance, even if the
              weighted average appears acceptable.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="benchmarks-thresholds"
            title="6. Benchmarks and critical thresholds"
            isMobile={isMobile}
          >
            <p>
              EcoTrack may compare your pillar scores against{" "}
              <strong>indicative sector baselines</strong>. These baselines are
              fixed reference values defined inside the EcoTrack model. They are
              designed to help users understand whether their maturity appears above,
              close to, or below a typical sector reference point.
            </p>

            <p>
              EcoTrack also applies a critical threshold. If any pillar — E, S, or G
              — scores <strong>{CRITICAL_PILLAR_THRESHOLD}% or below</strong>, the
              result is treated as a critical weakness.
            </p>

            <ul>
              <li>The overall score may be hidden or visually de-emphasised.</li>
              <li>The user is encouraged to address the weak pillar first.</li>
              <li>
                The result should be interpreted as a warning, not as a balanced ESG
                maturity profile.
              </li>
            </ul>

            <Callout tone="blue" title="Why this rule exists">
              A company with one very weak ESG pillar can face significant risk even
              if the other two pillars are stronger. The critical threshold prevents
              the weighted average from masking serious gaps.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="using-results"
            title="7. How to use EcoTrack results"
            isMobile={isMobile}
          >
            <p>
              EcoTrack results should be used as a structured starting point for ESG
              improvement. The goal is not to “chase a score”, but to identify weak
              practices and prioritise practical action.
            </p>

            <ul>
              <li>
                Use the <strong>pillar breakdown</strong> to identify your weakest
                ESG area.
              </li>
              <li>
                Review <strong>question-level answers</strong> to understand which
                practices are missing, informal, or incomplete.
              </li>
              <li>
                Use the <strong>suggestions</strong> as improvement prompts, not as
                legal or technical instructions.
              </li>
              <li>
                Repeat the assessment periodically to track progress over time.
              </li>
            </ul>

            <Callout tone="slate" title="Recommended review cycle">
              For most SMEs, repeating the assessment every 3–6 months is reasonable,
              especially after implementing new policies, procedures, data systems,
              training, or governance controls.
            </Callout>
          </MethodologySection>

          <MethodologySection
            id="benchmarking-method"
            title="8. How benchmarking is calculated"
            isMobile={isMobile}
          >
            <p>
              Benchmarking in EcoTrack is based on{" "}
              <strong>fixed sector baseline values</strong>. These values are stored
              inside the application for each sector and each ESG pillar.
            </p>

            <p>For each sector, EcoTrack defines:</p>

            <ul>
              <li>a baseline Environmental score,</li>
              <li>a baseline Social score, and</li>
              <li>a baseline Governance score.</li>
            </ul>

            <p>
              The gap is calculated separately for each pillar:
            </p>

            <div style={styles.formula}>
              Gap per pillar = Your pillar score − Sector baseline for the same
              pillar
            </div>

            <p>
              The result can then be interpreted as above, close to, or below the
              sector baseline.
            </p>

            <Callout tone="orange" title="Benchmarking limitation">
              EcoTrack benchmarks are indicative internal baselines. They are not
              live market averages, official industry statistics, external ESG
              ratings, or verified peer rankings.
            </Callout>
          </MethodologySection>

          <MethodologySection id="faq" title="9. FAQ" isMobile={isMobile}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  1. Is EcoTrack an official ESG rating or certification?
                </h3>
                <p style={{ fontSize: 14 }}>
                  No. EcoTrack is a self-assessment and decision-support tool. It
                  helps identify ESG maturity, gaps, and improvement priorities, but
                  it does not provide third-party certification or an official ESG
                  rating.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  2. Can EcoTrack be used for CSRD or ESRS reporting?
                </h3>
                <p style={{ fontSize: 14 }}>
                  EcoTrack can support awareness, readiness, and internal gap
                  analysis. It is not a substitute for CSRD/ESRS reporting, double
                  materiality assessment, external assurance, legal advice, or a
                  formal sustainability statement.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  3. Are my answers verified?
                </h3>
                <p style={{ fontSize: 14 }}>
                  No. EcoTrack does not verify evidence or documentation. Results
                  depend on the accuracy and completeness of the information provided
                  by the user.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  4. Why is the final score sometimes hidden?
                </h3>
                <p style={{ fontSize: 14 }}>
                  If any ESG pillar scores {CRITICAL_PILLAR_THRESHOLD}% or below,
                  EcoTrack may hide or de-emphasise the final weighted score. This
                  prevents one strong pillar from masking a critical weakness in
                  another pillar.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  5. Where do the benchmark values come from?
                </h3>
                <p style={{ fontSize: 14 }}>
                  Benchmark values are indicative sector baselines defined inside the
                  EcoTrack model. They are not real-time peer data, public statistics,
                  or external ESG ratings.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  6. Can multiple assessments be compared over time?
                </h3>
                <p style={{ fontSize: 14 }}>
                  Yes, but comparisons should be interpreted carefully. If scoring
                  rules, sector weights, benchmark values, or questionnaire content
                  change over time, older and newer assessments may not be perfectly
                  comparable.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                  7. Who can I contact for questions?
                </h3>
                <p style={{ fontSize: 14 }}>
                  You can contact us at{" "}
                  <a href="mailto:info@viridisconsultancy.com">
                    info@viridisconsultancy.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </MethodologySection>

          <MethodologySection
            id="disclaimer"
            title="10. Disclaimer and limitations"
            isMobile={isMobile}
          >
            <Callout tone="orange" title="Important">
              EcoTrack is a self-assessment and decision-support tool. It is not an
              audit, certification, assurance service, legal opinion, financial
              advice, or compliance guarantee.
            </Callout>

            <p>
              EcoTrack is designed to help users understand ESG maturity, identify
              gaps, and structure improvement priorities. It should be used as a
              practical internal reference, not as a formal external validation of
              ESG performance.
            </p>

            <ul>
              <li>
                <strong>No audit or assurance:</strong> EcoTrack does not replace an
                independent ESG audit, financial due diligence, legal review, or
                assurance engagement.
              </li>
              <li>
                <strong>No compliance guarantee:</strong> EcoTrack does not
                guarantee compliance with CSRD, ESRS, EU Taxonomy, national laws, or
                sector-specific regulations.
              </li>
              <li>
                <strong>User responsibility:</strong> Results depend on the accuracy,
                completeness, and honesty of the answers provided.
              </li>
              <li>
                <strong>Indicative benchmarks:</strong> Sector baselines are internal
                reference values and do not represent official industry averages or
                verified peer performance.
              </li>
              <li>
                <strong>Model updates:</strong> Scoring rules, sector weights,
                benchmark values, questions, and suggestions may change as the tool
                evolves.
              </li>
              <li>
                <strong>Use of results:</strong> Business, investment, reporting, or
                compliance decisions should not be made solely on the basis of
                EcoTrack results.
              </li>
            </ul>

            <p>
              By using EcoTrack, users acknowledge that results are indicative and
              intended to support learning, prioritisation, and internal ESG
              improvement planning.
            </p>
          </MethodologySection>
        </div>
      </main>

      {showBackToTop && (
        <button
          type="button"
          onClick={handleBackToTop}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            padding: "9px 13px",
            borderRadius: 9999,
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
            fontSize: 12,
            cursor: "pointer",
            zIndex: 20,
            color: "#0F172A",
            fontWeight: 600,
          }}
        >
          ↑ Back to top
        </button>
      )}
    </div>
  );
};

export default Methodology;





