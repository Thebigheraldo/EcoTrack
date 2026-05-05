// src/utils/exportAssessmentPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getQuestionsForSector } from "./questions";

/* ---------- BRAND ---------- */
const BRAND = {
  primary: [20, 138, 88],
  primaryDark: [13, 110, 72],
  dark: [15, 23, 42],
  ink: [17, 24, 39],
  muted: [100, 116, 139],
  lightMuted: [148, 163, 184],
  line: [226, 232, 240],
  softBg: [248, 250, 252],
  white: [255, 255, 255],
  red: [185, 28, 28],
  amber: [180, 83, 9],
  green: [21, 128, 61],
};

/* ---------- BASIC HELPERS ---------- */
function formatDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;

    if (!d || Number.isNaN(d.getTime())) return "—";

    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date();

    if (!d || Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function safeText(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function sanitizeFilename(value) {
  return String(value || "assessment")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function clampPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function pillarLabel(pillar) {
  const p = String(pillar || "").toUpperCase();

  if (p === "E") return "Environmental";
  if (p === "S") return "Social";
  if (p === "G") return "Governance";

  return safeText(pillar);
}

function getRagColor(value) {
  const v = Number(value || 0);

  if (v >= 75) return BRAND.green;
  if (v >= 50) return BRAND.amber;
  return BRAND.red;
}

function getMaturityLabel(score) {
  const s = Number(score || 0);

  if (s < 30) return "Beginner";
  if (s < 60) return "Developing";
  if (s < 80) return "Advanced";
  return "Leading";
}

function getMaturityDescription(score) {
  const s = Number(score || 0);

  if (s < 30) {
    return "Basic ESG foundations are still missing. The priority should be to establish minimum policies, responsibilities, data collection and risk controls.";
  }

  if (s < 60) {
    return "Some ESG practices are in place, but they are likely incomplete, informal or inconsistently applied. The priority should be to structure and document the existing approach.";
  }

  if (s < 80) {
    return "The organisation shows solid ESG maturity. The next step is to improve consistency, evidence, performance tracking and internal ownership.";
  }

  return "The organisation shows a high level of ESG maturity. The priority should be continuous improvement, external communication and deeper integration into business decisions.";
}

function normalizeAnswer(value) {
  if (value === undefined || value === null || value === "") {
    return {
      label: "Not answered",
      score: "—",
      scoreValue: null,
    };
  }

  if (typeof value === "number") {
    const v = Math.max(0, Math.min(4, value));

    return {
      label:
        v === 0
          ? "Not in place"
          : v === 1
          ? "Informal / ad hoc"
          : v === 2
          ? "Partially structured"
          : v === 3
          ? "Implemented & documented"
          : "Advanced / best practice",
      score: `${v}/4`,
      scoreValue: v,
    };
  }

  if (typeof value === "object") {
    const rawScore =
      typeof value.score === "number"
        ? value.score
        : typeof value.value === "number"
        ? value.value
        : typeof value.points === "number"
        ? value.points
        : null;

    const s =
      typeof rawScore === "number" ? Math.max(0, Math.min(4, rawScore)) : null;

    return {
      label: value.label || value.answer || value.text || "—",
      score: s !== null ? `${s}/4` : "—",
      scoreValue: s,
    };
  }

  const str = String(value);

  if (str.toLowerCase() === "yes") {
    return {
      label: "Yes",
      score: "4/4",
      scoreValue: 4,
    };
  }

  if (str.toLowerCase() === "no") {
    return {
      label: "No",
      score: "0/4",
      scoreValue: 0,
    };
  }

  if (str.toLowerCase() === "partial") {
    return {
      label: "Partial",
      score: "2/4",
      scoreValue: 2,
    };
  }

  if (str.toLowerCase() === "unknown") {
    return {
      label: "Unknown",
      score: "—",
      scoreValue: null,
    };
  }

  return {
    label: str,
    score: "—",
    scoreValue: null,
  };
}

function getScoreFields(assessment) {
  const overall =
    clampPercent(assessment.overallScore) ??
    clampPercent(assessment.overall) ??
    clampPercent(assessment.score);

  const env =
    clampPercent(assessment.envScore) ??
    clampPercent(assessment.pillarScores?.E) ??
    clampPercent(assessment.pillars?.E);

  const soc =
    clampPercent(assessment.socScore) ??
    clampPercent(assessment.pillarScores?.S) ??
    clampPercent(assessment.pillars?.S);

  const gov =
    clampPercent(assessment.govScore) ??
    clampPercent(assessment.pillarScores?.G) ??
    clampPercent(assessment.pillars?.G);

  return {
    overall,
    env,
    soc,
    gov,
  };
}

function getPillarAtRisk(scores) {
  const rows = [
    ["Environmental", scores.env],
    ["Social", scores.soc],
    ["Governance", scores.gov],
  ].filter(([, value]) => typeof value === "number");

  if (!rows.length) return ["—", null];

  rows.sort((a, b) => a[1] - b[1]);
  return rows[0];
}

function prepareSuggestions(assessment) {
  const raw =
    assessment.tailoredSuggestions ||
    assessment.suggestions ||
    assessment.recommendations ||
    [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `suggestion-${index}`,
          text: item,
          tags: [],
        };
      }

      return {
        id: item.id || `suggestion-${index}`,
        text: item.text || item.action || item.title || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
      };
    })
    .filter((item) => item.text);
}

/* ---------- DRAWING HELPERS ---------- */
function drawHeader(pdf, PAGE, sectionTitle = "") {
  pdf.setFillColor(...BRAND.white);
  pdf.rect(0, 0, PAGE.width, 64, "F");

  pdf.setFillColor(...BRAND.primary);
  pdf.rect(0, 0, PAGE.width, 5, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text("EcoTrack", PAGE.margin, 34);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.muted);
  pdf.text("ESG Assessment Report", PAGE.margin + 68, 34);

  if (sectionTitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.muted);
    pdf.text(sectionTitle, PAGE.width - PAGE.margin, 34, {
      align: "right",
    });
  }

  pdf.setDrawColor(...BRAND.line);
  pdf.setLineWidth(0.6);
  pdf.line(PAGE.margin, 64, PAGE.width - PAGE.margin, 64);
}

function drawFooter(pdf, PAGE, pageNumber, pageCount) {
  pdf.setDrawColor(...BRAND.line);
  pdf.setLineWidth(0.6);
  pdf.line(
    PAGE.margin,
    PAGE.height - 46,
    PAGE.width - PAGE.margin,
    PAGE.height - 46
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND.lightMuted);

  pdf.text(
    "EcoTrack by Viridis - ESG self-assessment export. Not a certified audit, assurance engagement or legal compliance guarantee.",
    PAGE.margin,
    PAGE.height - 28
  );

  pdf.text(`Page ${pageNumber} / ${pageCount}`, PAGE.width - PAGE.margin, PAGE.height - 28, {
    align: "right",
  });
}

function drawSectionTitle(pdf, title, subtitle, x, y, maxWidth) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...BRAND.dark);
  pdf.text(title, x, y);

  let nextY = y + 18;

  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.muted);

    const lines = pdf.splitTextToSize(subtitle, maxWidth);
    pdf.text(lines, x, nextY);

    nextY += lines.length * 12;
  }

  return nextY + 16;
}

function drawScoreCard(pdf, x, y, w, h, label, value, accent = BRAND.primary) {
  pdf.setFillColor(...BRAND.white);
  pdf.setDrawColor(...BRAND.line);
  pdf.roundedRect(x, y, w, h, 10, 10, "FD");

  pdf.setFillColor(...accent);
  pdf.roundedRect(x, y, w, 6, 10, 10, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(label, x + 12, y + 25);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...BRAND.dark);

  const safeValue = safeText(value);
  const maxTextWidth = w - 24;
  let fontSize = 18;

  while (fontSize > 10) {
    pdf.setFontSize(fontSize);
    if (pdf.getTextWidth(safeValue) <= maxTextWidth) break;
    fontSize -= 1;
  }

  pdf.text(safeValue, x + 12, y + 50);
}

function drawPillarBar(pdf, x, y, w, label, value) {
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : 0;
  const color = getRagColor(v);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...BRAND.ink);
  pdf.text(label, x, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...BRAND.ink);
  pdf.text(`${v}%`, x + w, y, { align: "right" });

  pdf.setFillColor(...BRAND.line);
  pdf.roundedRect(x, y + 8, w, 9, 999, 999, "F");

  pdf.setFillColor(...color);
  pdf.roundedRect(x, y + 8, (w * v) / 100, 9, 999, 999, "F");
}

function drawWrappedParagraph(pdf, text, x, y, maxWidth, options = {}) {
  const {
    fontSize = 10,
    lineHeight = 12,
    color = BRAND.ink,
    fontStyle = "normal",
  } = options;

  pdf.setFont("helvetica", fontStyle);
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...color);

  const lines = pdf.splitTextToSize(String(text || ""), maxWidth);
  pdf.text(lines, x, y);

  return y + lines.length * lineHeight;
}

/* ---------- MAIN EXPORT ---------- */
export function exportAssessmentPDF(assessment, options = {}) {
  if (!assessment) return;

  const {
    organizationName = "",
    userEmail = "",
    filePrefix = "EcoTrack_Assessment",
  } = options;

  const sector = assessment.sector || "Unknown sector";
  const questions = Array.isArray(assessment.questions)
    ? assessment.questions
    : getQuestionsForSector(sector) || [];

  const answers = assessment.answers || {};
  const scores = getScoreFields(assessment);
  const suggestions = prepareSuggestions(assessment);

  const generatedAt = new Date();
  const createdDate = formatDate(assessment.createdAt);
  const completedDate = formatDate(assessment.completedAt || assessment.updatedAt);
  const generatedDateTime = formatDateTime(generatedAt);

  const [pillarAtRiskLabel, pillarAtRiskValue] = getPillarAtRisk(scores);

  const overallLabel =
    scores.overall !== null && scores.overall !== undefined
      ? `${scores.overall}%`
      : "—";

  const maturity =
    scores.overall !== null && scores.overall !== undefined
      ? getMaturityLabel(scores.overall)
      : "—";

  const rating = assessment.rating || maturity;

  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const PAGE = {
    width: pdf.internal.pageSize.getWidth(),
    height: pdf.internal.pageSize.getHeight(),
    margin: 48,
    top: 86,
    bottom: 60,
  };

  const contentWidth = PAGE.width - PAGE.margin * 2;

  pdf.setProperties({
    title: "EcoTrack ESG Assessment Report",
    subject: `EcoTrack ESG assessment - ${sector}`,
    author: "EcoTrack by Viridis",
    creator: "EcoTrack by Viridis",
    keywords: "ESG, sustainability, assessment, EcoTrack, Viridis",
  });

  /* =========================================================
     COVER PAGE
  ========================================================= */
  pdf.setFillColor(...BRAND.dark);
  pdf.rect(0, 0, PAGE.width, PAGE.height, "F");

  pdf.setFillColor(...BRAND.primary);
  pdf.rect(0, 0, PAGE.width, 10, "F");

  // Brand mark
  pdf.setFillColor(...BRAND.white);
  pdf.roundedRect(PAGE.margin, 44, 150, 42, 12, 12, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...BRAND.primary);
  pdf.text("EcoTrack", PAGE.margin + 18, 71);

  pdf.setFillColor(...BRAND.white);
  pdf.setTextColor(...BRAND.dark);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);

  const confidentialText = "CONFIDENTIAL - INTERNAL USE";
  const confidentialW = pdf.getTextWidth(confidentialText) + 22;

  pdf.roundedRect(
    PAGE.width - PAGE.margin - confidentialW,
    52,
    confidentialW,
    24,
    999,
    999,
    "F"
  );

  pdf.text(
    confidentialText,
    PAGE.width - PAGE.margin - confidentialW + 11,
    68
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(30);
  pdf.setTextColor(...BRAND.white);
  pdf.text("ESG Assessment Report", PAGE.margin, 145);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(220, 230, 240);
  pdf.text("Generated from your EcoTrack assessment history", PAGE.margin, 168);

  // Main score panel
  pdf.setFillColor(...BRAND.white);
  pdf.roundedRect(PAGE.margin, 215, contentWidth, 165, 18, 18, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.muted);
  pdf.text("Overall ESG score", PAGE.margin + 22, 246);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(48);
  pdf.setTextColor(...BRAND.primary);
  pdf.text(overallLabel, PAGE.margin + 22, 305);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND.dark);
  pdf.text(`Maturity: ${safeText(rating)}`, PAGE.margin + 24, 333);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(
    `Pillar at risk: ${pillarAtRiskLabel}${
      typeof pillarAtRiskValue === "number" ? ` (${pillarAtRiskValue}%)` : ""
    }`,
    PAGE.margin + 24,
    352
  );

  const chipX = PAGE.margin + 325;
  const chipW = contentWidth - 347;

  const drawCoverPillar = (label, value, y) => {
    const v = typeof value === "number" ? value : 0;
    const color = getRagColor(v);

    pdf.setFillColor(...color);
    pdf.roundedRect(chipX, y, chipW, 34, 10, 10, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.white);
    pdf.text(label, chipX + 12, y + 21);

    pdf.setFontSize(13);
    pdf.text(
      typeof value === "number" ? `${value}%` : "—",
      chipX + chipW - 12,
      y + 22,
      { align: "right" }
    );
  };

  drawCoverPillar("Environmental", scores.env, 238);
  drawCoverPillar("Social", scores.soc, 283);
  drawCoverPillar("Governance", scores.gov, 328);

  // Report details card
  pdf.setFillColor(...BRAND.white);
  pdf.roundedRect(PAGE.margin, 405, contentWidth, 230, 18, 18, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text("Report details", PAGE.margin + 20, 434);

  const coverMeta = [
    ["Organization", safeText(organizationName)],
    ["User email", safeText(userEmail)],
    ["Sector", safeText(sector)],
    ["Assessment ID", safeText(assessment.id)],
    ["Status", safeText(assessment.status)],
    ["Created", createdDate],
    ["Completed / updated", completedDate],
    ["Generated", generatedDateTime],
  ];

  autoTable(pdf, {
    startY: 448,
    head: [],
    body: coverMeta,
    theme: "plain",
    margin: {
      left: PAGE.margin + 20,
      right: PAGE.margin + 20,
    },
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 4,
      textColor: BRAND.ink,
      overflow: "linebreak",
    },
    columnStyles: {
      0: {
        cellWidth: 125,
        textColor: BRAND.muted,
        fontStyle: "normal",
      },
      1: {
        cellWidth: contentWidth - 165,
        fontStyle: "bold",
      },
    },
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(210, 220, 230);
  pdf.text(
    "This report is based on self-reported information and is intended for internal decision support.",
    PAGE.margin,
    PAGE.height - 42
  );

  /* =========================================================
     EXECUTIVE SUMMARY
  ========================================================= */
  pdf.addPage();

  let y = PAGE.top;

  y = drawSectionTitle(
    pdf,
    "Executive summary",
    "A concise overview of the assessment result, ESG maturity, pillar performance and recommended next steps.",
    PAGE.margin,
    y,
    contentWidth
  );

  const cardGap = 10;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 68;

  drawScoreCard(
    pdf,
    PAGE.margin,
    y,
    cardW,
    cardH,
    "Overall score",
    overallLabel,
    BRAND.primary
  );

  drawScoreCard(
    pdf,
    PAGE.margin + (cardW + cardGap),
    y,
    cardW,
    cardH,
    "Maturity",
    maturity,
    BRAND.primary
  );

  drawScoreCard(
    pdf,
    PAGE.margin + (cardW + cardGap) * 2,
    y,
    cardW,
    cardH,
    "Rating",
    safeText(rating),
    BRAND.primaryDark
  );

  drawScoreCard(
    pdf,
    PAGE.margin + (cardW + cardGap) * 3,
    y,
    cardW,
    cardH,
    "Pillar at risk",
    typeof pillarAtRiskValue === "number"
      ? `${pillarAtRiskLabel} ${pillarAtRiskValue}%`
      : "—",
    typeof pillarAtRiskValue === "number"
      ? getRagColor(pillarAtRiskValue)
      : BRAND.muted
  );

  y += cardH + 28;

  // Interpretation box
  pdf.setFillColor(...BRAND.softBg);
  pdf.setDrawColor(...BRAND.line);
  pdf.roundedRect(PAGE.margin, y, contentWidth, 110, 14, 14, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...BRAND.dark);
  pdf.text("Interpretation", PAGE.margin + 16, y + 26);

  const interpretationText =
    scores.overall !== null && scores.overall !== undefined
      ? getMaturityDescription(scores.overall)
      : "The overall maturity level could not be calculated because score data is missing from this assessment export.";

  drawWrappedParagraph(
    pdf,
    interpretationText,
    PAGE.margin + 16,
    y + 48,
    contentWidth - 32,
    {
      fontSize: 10,
      lineHeight: 13,
      color: BRAND.ink,
    }
  );

  y += 132;

  // Pillar performance
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text("Pillar performance", PAGE.margin, y);

  y += 24;

  drawPillarBar(pdf, PAGE.margin, y, contentWidth, "Environmental", scores.env);
  y += 36;
  drawPillarBar(pdf, PAGE.margin, y, contentWidth, "Social", scores.soc);
  y += 36;
  drawPillarBar(pdf, PAGE.margin, y, contentWidth, "Governance", scores.gov);
  y += 40;

  /* =========================================================
     ACTION PLAN
  ========================================================= */
  pdf.addPage();

  y = PAGE.top;

  y = drawSectionTitle(
    pdf,
    "Recommended action plan",
    "Suggested next steps based on the assessment result. These actions should be reviewed and adapted before implementation.",
    PAGE.margin,
    y,
    contentWidth
  );

  const actionRows = suggestions.length
    ? suggestions.slice(0, 12).map((s, index) => [
        index + 1,
        s.text,
        s.tags && s.tags.length ? s.tags.slice(0, 4).map((t) => `#${t}`).join(" ") : "—",
        index < 3 ? "High" : index < 7 ? "Medium" : "Low",
      ])
    : [
        [
          "—",
          "No tailored suggestions were found for this assessment. Review the questionnaire responses and define improvement actions manually.",
          "—",
          "—",
        ],
      ];

  autoTable(pdf, {
    startY: y,
    head: [["#", "Recommended action", "Tags", "Priority"]],
    body: actionRows,
    theme: "striped",
    margin: {
      left: PAGE.margin,
      right: PAGE.margin,
      top: PAGE.top,
      bottom: PAGE.bottom,
    },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "top",
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: {
        cellWidth: 30,
        halign: "center",
      },
      1: {
        cellWidth: contentWidth - 30 - 115 - 70,
      },
      2: {
        cellWidth: 115,
        textColor: BRAND.muted,
      },
      3: {
        cellWidth: 70,
        halign: "center",
        fontStyle: "bold",
      },
    },
  });

  /* =========================================================
     ASSESSMENT DETAILS
  ========================================================= */
  pdf.addPage();

  y = PAGE.top;

  y = drawSectionTitle(
    pdf,
    "Assessment details",
    "Key information and score breakdown for this specific saved assessment.",
    PAGE.margin,
    y,
    contentWidth
  );

  const metaRows = [
    ["Organization", safeText(organizationName)],
    ["User email", safeText(userEmail)],
    ["Sector", safeText(sector)],
    ["Assessment ID", safeText(assessment.id)],
    ["Status", safeText(assessment.status)],
    ["Created", createdDate],
    ["Completed / updated", completedDate],
    ["Generated", generatedDateTime],
    ["Overall score", scores.overall !== null ? `${scores.overall}%` : "—"],
    ["Environmental", scores.env !== null ? `${scores.env}%` : "—"],
    ["Social", scores.soc !== null ? `${scores.soc}%` : "—"],
    ["Governance", scores.gov !== null ? `${scores.gov}%` : "—"],
  ];

  autoTable(pdf, {
    startY: y,
    head: [["Field", "Value"]],
    body: metaRows,
    theme: "grid",
    margin: {
      left: PAGE.margin,
      right: PAGE.margin,
      top: PAGE.top,
      bottom: PAGE.bottom,
    },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 7,
      overflow: "linebreak",
      valign: "top",
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND.dark,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: {
        cellWidth: 145,
        textColor: BRAND.muted,
        fontStyle: "bold",
      },
      1: {
        cellWidth: contentWidth - 145,
      },
    },
  });

  y = pdf.lastAutoTable.finalY + 28;

  pdf.setFillColor(255, 251, 235);
  pdf.setDrawColor(253, 186, 116);
  pdf.roundedRect(PAGE.margin, y, contentWidth, 86, 12, 12, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(124, 45, 18);
  pdf.text("Important limitation", PAGE.margin + 14, y + 24);

  drawWrappedParagraph(
    pdf,
    "EcoTrack is a self-assessment tool. The results are indicative and depend on the accuracy of the information provided by the user. This export is not a certified ESG audit, external assurance report, legal opinion or compliance guarantee.",
    PAGE.margin + 14,
    y + 44,
    contentWidth - 28,
    {
      fontSize: 9.5,
      lineHeight: 12,
      color: [124, 45, 18],
    }
  );

  /* =========================================================
     APPENDIX - RESPONSES
  ========================================================= */
  pdf.addPage();

  y = PAGE.top;

  y = drawSectionTitle(
    pdf,
    "Appendix - questionnaire responses",
    "Full list of questions and answers saved for this assessment. Legacy answer IDs are included when a saved answer no longer matches the current question set.",
    PAGE.margin,
    y,
    contentWidth
  );

  const knownQuestionIds = new Set(questions.map((q) => q.id));

  const questionRows = questions.map((q, index) => {
    const answer = normalizeAnswer(answers[q.id]);

    return [
      index + 1,
      pillarLabel(q.pillar),
      q.text || q.question || q.title || q.id,
      answer.label,
      answer.score,
      q.critical ? "Yes" : "No",
    ];
  });

  const unmatchedRows = Object.entries(answers)
    .filter(([id]) => !knownQuestionIds.has(id))
    .map(([id, value]) => {
      const answer = normalizeAnswer(value);

      return [
        "—",
        "Legacy",
        `Legacy/unmatched question ID: ${id}`,
        answer.label,
        answer.score,
        "—",
      ];
    });

  const allRows = [...questionRows, ...unmatchedRows];

  autoTable(pdf, {
    startY: y,
    head: [["#", "Pillar", "Question", "Answer", "Score", "Critical"]],
    body: allRows.length
      ? allRows
      : [["—", "—", "No answers found for this assessment.", "—", "—", "—"]],
    theme: "grid",
    margin: {
      left: PAGE.margin,
      right: PAGE.margin,
      top: PAGE.top,
      bottom: PAGE.bottom,
    },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4.5,
      overflow: "linebreak",
      valign: "top",
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND.dark,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: {
        cellWidth: 26,
        halign: "center",
      },
      1: {
        cellWidth: 74,
      },
      2: {
        cellWidth: contentWidth - 26 - 74 - 126 - 46 - 50,
      },
      3: {
        cellWidth: 126,
      },
      4: {
        cellWidth: 46,
        halign: "center",
      },
      5: {
        cellWidth: 50,
        halign: "center",
      },
    },
  });

  /* =========================================================
     HEADER / FOOTER ON EVERY PAGE
  ========================================================= */
  const pageCount = pdf.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);

    if (i > 1) {
      const section =
        i === 2
          ? "Executive summary"
          : i === 3
          ? "Recommended action plan"
          : i === 4
          ? "Assessment details"
          : "Appendix";

      drawHeader(pdf, PAGE, section);
    }

    drawFooter(pdf, PAGE, i, pageCount);
  }

  const safeSector = sanitizeFilename(sector);
  const safeDate = new Date().toISOString().slice(0, 10);

  pdf.save(`${filePrefix}_${safeSector}_${safeDate}.pdf`);
}