// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import TopNav from "../components/TopNav";
import "../components/landing.css";

import { db } from "../firebase";
import { collectionGroup, getDocs } from "firebase/firestore";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ---------- Helpers ---------- */

const formatDate = (ts) => {
  if (!ts) return "";
  if (ts.toDate) return ts.toDate().toLocaleDateString("en-GB");
  if (ts instanceof Date) return ts.toLocaleDateString("en-GB");
  return "";
};

const getWeakestPillar = (a) => {
  const entries = [
    ["E", a.eScore],
    ["S", a.sScore],
    ["G", a.gScore],
  ].filter(([_, v]) => typeof v === "number");
  if (!entries.length) return "-";
  entries.sort((x, y) => x[1] - y[1]);
  return entries[0][0];
};

const getScoreColor = (score) => {
  if (score == null || isNaN(score)) return "#e5e7eb"; // grey
  if (score < 40) return "#fecaca"; // red-ish
  if (score < 60) return "#fef9c3"; // yellow
  if (score < 80) return "#bbf7d0"; // light green
  return "#22c55e"; // strong green
};

function KpiCard({ label, value, subtitle }) {
  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: 0,
        padding: 16,
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function PillBadge({ label, score }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        backgroundColor: getScoreColor(score),
        marginRight: 6,
      }}
    >
      <strong style={{ marginRight: 4 }}>{label}</strong>{" "}
      {score != null ? `${score}%` : "–"}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 140 }}>
      <span style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          borderRadius: 999,
          border: "1px solid #e2e8f0",
          padding: "6px 12px",
          fontSize: 12,
          backgroundColor: "#f8fafc",
        }}
      >
        <option value="all">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: "#94a3b8",
      }}
    >
      Not enough data for this view.
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function AdminDashboard() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // basic breakpoint
  const [isMobile, setIsMobile] = useState(false);

  // filters
  const [sectorFilter, setSectorFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");

  // selected for modal
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  /* ---- Breakpoint logic ---- */
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ---- Load data from Firestore ---- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const qRef = collectionGroup(db, "assessments");
        const snap = await getDocs(qRef);

        const rows = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const pillars = d.pillarScores || {};

          // schema: 0–1 → convert to 0–100
          const overall =
            typeof d.overall === "number"
              ? Math.round(d.overall * 100)
              : null;
          const eScore =
            typeof pillars.E === "number"
              ? Math.round(pillars.E * 100)
              : null;
          const sScore =
            typeof pillars.S === "number"
              ? Math.round(pillars.S * 100)
              : null;
          const gScore =
            typeof pillars.G === "number"
              ? Math.round(pillars.G * 100)
              : null;

          return {
            id: docSnap.id,
            alias: "Anonymous", // stays anonymous
            sector: d.sector || "Unknown",
            overallScore: overall,
            eScore,
            sScore,
            gScore,
            rating: d.rating || null,
            critical: !!d.critical,
            createdAt: d.createdAt || null,
          };
        });

        // sort client-side by date desc
        rows.sort((a, b) => {
          const da = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const db = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!da || !db) return 0;
          return db - da;
        });

        setAssessments(rows);
        console.log("[Admin] fetched rows:", rows);
      } catch (err) {
        console.error("[Admin] Error loading assessments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* ---- Filtered data ---- */

  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      if (sectorFilter !== "all" && a.sector !== sectorFilter) return false;

      if (scoreFilter !== "all" && a.overallScore != null) {
        const [min, max] = scoreFilter.split("-").map(Number);
        if (a.overallScore < min || a.overallScore > max) return false;
      }

      return true;
    });
  }, [assessments, sectorFilter, scoreFilter]);

  /* ---- KPI calculations ---- */

  const kpis = useMemo(() => {
    if (!filtered.length) {
      return {
        total: 0,
        avgOverall: 0,
        avgE: 0,
        avgS: 0,
        avgG: 0,
        weakestMostCommon: "-",
        topSector: "-",
      };
    }

    const total = filtered.length;
    let sumOverall = 0,
      sumE = 0,
      sumS = 0,
      sumG = 0;

    const weakCounts = { E: 0, S: 0, G: 0 };
    const sectorCounts = {};

    filtered.forEach((a) => {
      if (a.overallScore != null) sumOverall += a.overallScore;
      if (a.eScore != null) sumE += a.eScore;
      if (a.sScore != null) sumS += a.sScore;
      if (a.gScore != null) sumG += a.gScore;

      const weak = getWeakestPillar(a);
      if (weak !== "-") weakCounts[weak]++;

      sectorCounts[a.sector] = (sectorCounts[a.sector] || 0) + 1;
    });

    const avgOverall = Math.round(sumOverall / total) || 0;
    const avgE = Math.round(sumE / total) || 0;
    const avgS = Math.round(sumS / total) || 0;
    const avgG = Math.round(sumG / total) || 0;

    const weakestMostCommonEntry = Object.entries(weakCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const weakestMostCommon = weakestMostCommonEntry
      ? weakestMostCommonEntry[0]
      : "-";

    const topSectorEntry = Object.entries(sectorCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const topSector = topSectorEntry ? topSectorEntry[0] : "-";

    return {
      total,
      avgOverall,
      avgE,
      avgS,
      avgG,
      weakestMostCommon,
      topSector,
    };
  }, [filtered]);

  /* ---- Charts data ---- */

  const bySectorData = useMemo(() => {
    const map = {};
    filtered.forEach((a) => {
      if (!map[a.sector]) {
        map[a.sector] = {
          sector: a.sector,
          avgOverall: 0,
          avgE: 0,
          avgS: 0,
          avgG: 0,
          count: 0,
        };
      }
      const obj = map[a.sector];
      if (a.overallScore != null) obj.avgOverall += a.overallScore;
      if (a.eScore != null) obj.avgE += a.eScore;
      if (a.sScore != null) obj.avgS += a.sScore;
      if (a.gScore != null) obj.avgG += a.gScore;
      obj.count += 1;
    });

    return Object.values(map).map((m) => ({
      sector: m.sector,
      avgOverall: Math.round(m.avgOverall / m.count) || 0,
      avgE: Math.round(m.avgE / m.count) || 0,
      avgS: Math.round(m.avgS / m.count) || 0,
      avgG: Math.round(m.avgG / m.count) || 0,
    }));
  }, [filtered]);

  const usageOverTimeData = useMemo(() => {
    const map = {};
    filtered.forEach((a) => {
      if (!a.createdAt) return;
      const d = a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, count]) => ({ month, count }));
  }, [filtered]);

  /* ---- Heatmap data ---- */

  const heatmapData = useMemo(() => {
    return bySectorData.map((s) => ({
      sector: s.sector,
      E: s.avgE,
      S: s.avgS,
      G: s.avgG,
    }));
  }, [bySectorData]);

  /* ---- Simple anomaly / insight calculation ---- */

  const insights = useMemo(() => {
    if (!filtered.length) return [];

    const veryLow = filtered.filter(
      (a) => a.overallScore != null && a.overallScore < 20
    );
    const veryHigh = filtered.filter(
      (a) => a.overallScore != null && a.overallScore > 85
    );

    const lines = [];

    lines.push(
      `Most common weakest pillar is ${kpis.weakestMostCommon || "-"} (across ${
        filtered.length
      } assessments).`
    );

    if (veryLow.length) {
      const sectors = Array.from(new Set(veryLow.map((a) => a.sector)));
      lines.push(
        `${veryLow.length} assessment(s) have overall ESG < 20%. Sectors involved: ${sectors.join(
          ", "
        )}.`
      );
    }

    if (veryHigh.length) {
      const sectors = Array.from(new Set(veryHigh.map((a) => a.sector)));
      lines.push(
        `${veryHigh.length} assessment(s) have overall ESG > 85%. Potential best-practice cases in: ${sectors.join(
          ", "
        )}.`
      );
    }

    return lines;
  }, [filtered, kpis.weakestMostCommon]);

  /* ---- Options for filters ---- */

  const sectorOptions = useMemo(() => {
    const set = new Set(assessments.map((a) => a.sector));
    set.delete("Unknown");
    return Array.from(set);
  }, [assessments]);

  /* ---- Actions: CSV export ---- */

  const handleExportCsv = () => {
    if (!filtered.length) {
      alert("Nothing to export – no assessments match the current filters.");
      return;
    }

    const header = [
      "id",
      "alias",
      "sector",
      "overall",
      "E",
      "S",
      "G",
      "rating",
      "critical",
      "createdAt",
    ];

    const rows = filtered.map((a) => [
      a.id,
      a.alias,
      a.sector,
      a.overallScore ?? "",
      a.eScore ?? "",
      a.sScore ?? "",
      a.gScore ?? "",
      a.rating ?? "",
      a.critical ? "true" : "false",
      formatDate(a.createdAt),
    ]);

    const csv =
      header.join(",") +
      "\n" +
      rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = "EcoTrack-admin-export.csv";
    document.body.appendChild(aEl);
    aEl.click();
    document.body.removeChild(aEl);
    URL.revokeObjectURL(url);
  };

  /* ---- Actions: PDF export ---- */

  const handleExportPdf = async () => {
    const node = document.getElementById("admin-dashboard-root");
    if (!node) return;

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      scrollY: -window.scrollY,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save("EcoTrack-admin-dashboard.pdf");
  };

  /* ---------- Render ---------- */

  return (
    <div className="landing" style={{ alignItems: "stretch" }}>
      <TopNav />
      <div
        id="admin-dashboard-root"
        style={{
          maxWidth: 1200,
          margin: isMobile ? "70px auto 24px" : "80px auto 40px",
          width: "100%",
          padding: isMobile ? "0 12px 24px" : "0 24px 40px",
        }}
      >
        <div style={{ marginBottom: isMobile ? 16 : 24 }}>
          <h1
            style={{
              fontSize: isMobile ? 20 : 24,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            EcoTrack Admin Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Anonymous analytics overview of all completed ESG self-assessments.
          </p>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Loaded assessments from Firestore: {assessments.length}
          </p>
        </div>

        {/* Filters + top actions */}
        <div
          className="card"
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            marginBottom: 20,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            flexWrap: "wrap",
            gap: 12,
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <FilterSelect
              label="Sector"
              value={sectorFilter}
              onChange={setSectorFilter}
              options={sectorOptions}
              allLabel="All sectors"
            />
            <FilterSelect
              label="Score range"
              value={scoreFilter}
              onChange={setScoreFilter}
              options={["0-40", "40-60", "60-80", "80-100"]}
              allLabel="All scores"
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: isMobile ? "flex-start" : "flex-end",
            }}
          >
            <button
              type="button"
              style={{
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                padding: "6px 12px",
                fontSize: 12,
                background: "#f8fafc",
                cursor: "pointer",
              }}
              onClick={handleExportCsv}
            >
              ⬇️ Export CSV
            </button>
            <button
              type="button"
              style={{
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                padding: "6px 12px",
                fontSize: 12,
                background: "#f1f5f9",
                cursor: "pointer",
              }}
              onClick={handleExportPdf}
            >
              📄 Export PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</div>
        ) : (
          <>
            {/* KPI Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "minmax(0, 1fr)"
                  : "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 12,
                marginBottom: isMobile ? 16 : 24,
              }}
            >
              <KpiCard label="Total assessments" value={kpis.total} />
              <KpiCard
                label="Average ESG score"
                value={`${kpis.avgOverall || 0}%`}
                subtitle="Filtered selection"
              />
              <KpiCard
                label="Average by pillar"
                value={
                  <>
                    <PillBadge label="E" score={kpis.avgE} />
                    <PillBadge label="S" score={kpis.avgS} />
                    <PillBadge label="G" score={kpis.avgG} />
                  </>
                }
                subtitle="Across filtered assessments"
              />
              <KpiCard
                label="Most common weakest pillar"
                value={kpis.weakestMostCommon}
                subtitle="Where SMEs struggle most"
              />
              <KpiCard
                label="Most represented sector"
                value={kpis.topSector}
                subtitle="Within current filters"
              />
            </div>

            {/* Charts */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 2fr) minmax(0, 2fr)",
                gap: 20,
                marginBottom: isMobile ? 16 : 24,
              }}
            >
              <div
                className="card"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  minHeight: isMobile ? 220 : 260,
                }}
              >
                <h2
                  style={{
                    fontSize: 14,
                    marginBottom: 12,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  Average ESG score by sector
                </h2>
                {bySectorData.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height={isMobile ? 200 : 220}
                  >
                    <BarChart data={bySectorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sector" fontSize={11} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avgOverall" name="Avg ESG %">
                        {bySectorData.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={getScoreColor(entry.avgOverall)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState />
                )}
              </div>

              <div
                className="card"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  minHeight: isMobile ? 220 : 260,
                }}
              >
                <h2
                  style={{
                    fontSize: 14,
                    marginBottom: 12,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  Pillar comparison by sector
                </h2>
                {bySectorData.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height={isMobile ? 200 : 220}
                  >
                    <BarChart data={bySectorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sector" fontSize={11} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avgE" name="E %" fill="#38bdf8" />
                      <Bar dataKey="avgS" name="S %" fill="#a855f7" />
                      <Bar dataKey="avgG" name="G %" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>

            {/* Heatmap + timeline + insights */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 2.2fr) minmax(0, 1.8fr)",
                gap: 20,
                marginBottom: isMobile ? 16 : 24,
              }}
            >
              {/* Heatmap */}
              <div
                className="card"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  minHeight: 220,
                }}
              >
                <h2
                  style={{
                    fontSize: 14,
                    marginBottom: 12,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  ESG heatmap by sector & pillar
                </h2>
                {heatmapData.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e2e8f0",
                            backgroundColor: "#f8fafc",
                          }}
                        >
                          <th style={{ padding: "6px 8px" }}>Sector</th>
                          <th style={{ padding: "6px 8px" }}>E</th>
                          <th style={{ padding: "6px 8px" }}>S</th>
                          <th style={{ padding: "6px 8px" }}>G</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapData.map((row) => (
                          <tr key={row.sector}>
                            <td style={{ padding: "6px 8px" }}>{row.sector}</td>
                            {["E", "S", "G"].map((pillar) => (
                              <td
                                key={pillar}
                                style={{
                                  padding: "6px 8px",
                                  backgroundColor: getScoreColor(
                                    row[pillar]
                                  ),
                                  textAlign: "center",
                                }}
                              >
                                {row[pillar] != null ? `${row[pillar]}%` : "–"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>

              {/* Usage over time + insights */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  className="card"
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    minHeight: 140,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 14,
                      marginBottom: 12,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Assessments over time
                  </h2>
                  {usageOverTimeData.length ? (
                    <ResponsiveContainer
                      width="100%"
                      height={isMobile ? 160 : 180}
                    >
                      <LineChart data={usageOverTimeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name="# assessments"
                          dot
                          stroke="#0ea5e9"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </div>

                <div
                  className="card"
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <h2
                    style={{
                      fontSize: 14,
                      marginBottom: 8,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Quick ESG insights
                  </h2>
                  {insights.length ? (
                    <ul
                      style={{
                        paddingLeft: 18,
                        fontSize: 12,
                        color: "#475569",
                      }}
                    >
                      {insights.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                      }}
                    >
                      Not enough data yet for meaningful insights.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div
              className="card"
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "flex-start" : "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  Assessments (detail)
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                  }}
                >
                  Click a row to see details
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e2e8f0",
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <th style={{ padding: "8px 6px" }}>#</th>
                      <th style={{ padding: "8px 6px" }}>Client</th>
                      <th style={{ padding: "8px 6px" }}>Sector</th>
                      <th style={{ padding: "8px 6px" }}>ESG %</th>
                      <th style={{ padding: "8px 6px" }}>E %</th>
                      <th style={{ padding: "8px 6px" }}>S %</th>
                      <th style={{ padding: "8px 6px" }}>G %</th>
                      <th style={{ padding: "8px 6px" }}>Weakest</th>
                      <th style={{ padding: "8px 6px" }}>Rating</th>
                      <th style={{ padding: "8px 6px" }}>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a, idx) => {
                      const weakest = getWeakestPillar(a);

                      return (
                        <tr
                          key={a.id}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            cursor: "pointer",
                          }}
                          onClick={() => setSelectedAssessment(a)}
                        >
                          <td style={{ padding: "8px 6px" }}>{idx + 1}</td>
                          <td style={{ padding: "8px 6px" }}>{a.alias}</td>
                          <td style={{ padding: "8px 6px" }}>{a.sector}</td>
                          <td style={{ padding: "8px 6px" }}>
                            {a.overallScore != null
                              ? `${a.overallScore}%`
                              : "–"}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {a.eScore != null ? `${a.eScore}%` : "–"}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {a.sScore != null ? `${a.sScore}%` : "–"}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {a.gScore != null ? `${a.gScore}%` : "–"}
                          </td>
                          <td style={{ padding: "8px 6px" }}>{weakest}</td>
                          <td style={{ padding: "8px 6px" }}>
                            {a.rating || (a.critical ? "Critical" : "–")}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {formatDate(a.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                    {!filtered.length && (
                      <tr>
                        <td
                          colSpan={10}
                          style={{
                            padding: 16,
                            textAlign: "center",
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          No assessments match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail modal */}
            {selectedAssessment && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <div
                  className="card"
                  style={{
                    width: "90%",
                    maxWidth: 480,
                    maxHeight: "90vh",
                    overflowY: "auto",
                    padding: 20,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    Assessment detail
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      marginBottom: 16,
                    }}
                  >
                    ID: {selectedAssessment.id} • Sector:{" "}
                    {selectedAssessment.sector} • Completed:{" "}
                    {formatDate(selectedAssessment.createdAt)}
                  </p>

                  <div style={{ marginBottom: 12 }}>
                    <strong>Overall ESG:</strong>{" "}
                    {selectedAssessment.overallScore != null
                      ? `${selectedAssessment.overallScore}%`
                      : "–"}{" "}
                    {selectedAssessment.rating && (
                      <span style={{ marginLeft: 6 }}>
                        ({selectedAssessment.rating})
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <PillBadge
                      label="E"
                      score={selectedAssessment.eScore ?? null}
                    />
                    <PillBadge
                      label="S"
                      score={selectedAssessment.sScore ?? null}
                    />
                    <PillBadge
                      label="G"
                      score={selectedAssessment.gScore ?? null}
                    />
                  </div>

                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    Critical flag:{" "}
                    {selectedAssessment.critical ? "Yes" : "No"}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 16,
                    }}
                  >
                    <button
                      className="btn"
                      onClick={() => setSelectedAssessment(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}





