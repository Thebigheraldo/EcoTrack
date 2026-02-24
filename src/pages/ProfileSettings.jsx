// src/pages/ProfileSettings.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { sendPasswordResetEmail, deleteUser } from "firebase/auth";
import TopNav from "../components/TopNav";
import "../components/landing.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- small helpers ---------- */
const lbl = {
  display: "block",
  fontSize: 12,
  color: "#64748b",
  marginBottom: 6,
};

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  background: "white",
};

function Card({ children, style }) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 6px 20px rgba(16,24,40,.06)",
        background: "#ffffff",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* =========================================================
   OPTIONS (IMPORTANT)
   Keep OPTION values aligned with what onboarding saves.
   Also includes legacy values to avoid "Select…" showing.
========================================================= */

const SECTORS = [
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Agriculture/Food", label: "Agriculture/Food" },
  { value: "Textile/Fashion", label: "Textile/Fashion" },
  { value: "Tech", label: "Tech" },
  { value: "Finance", label: "Finance" },
  { value: "Construction", label: "Construction" },
  { value: "Furniture", label: "Furniture" },
  { value: "Transportation", label: "Transportation" },
];

// SIZE — include both "1-9" (onboarding screenshot) and your previous ones
const SIZE_OPTIONS = [
  { value: "1-9", label: "1–9" },
  { value: "1-10", label: "1–10" },
  { value: "10-49", label: "10–49" },
  { value: "11-50", label: "11–50" },
  { value: "50-249", label: "50–249" },
  { value: "51-250", label: "51–250" },
  { value: "250-999", label: "250–999" },
  { value: "251-1000", label: "251–1000" },
  { value: "1000+", label: "1000+" },
];

// TURNOVER — include "<10M" (onboarding screenshot) + your legacy € tiers
const TURNOVER_OPTIONS = [
  { value: "<10M", label: "<€10M" },
  { value: "<€2M", label: "<€2M" },
  { value: "€2–10M", label: "€2–10M" },
  { value: "€10–50M", label: "€10–50M" },
  { value: "€50–250M", label: "€50–250M" },
  { value: "€250M+", label: "€250M+" },
];

// CSRD — include YES/NO (onboarding screenshot) + your legacy strings
const CSRD_OPTIONS = [
  { value: "YES", label: "Yes (in scope)" },
  { value: "NO", label: "No (out of scope)" },
  { value: "UNSURE", label: "Unsure" },
  { value: "In scope", label: "In scope" },
  { value: "Out of scope", label: "Out of scope" },
  { value: "Unsure", label: "Unsure" },
];

/* If Firestore has a value not present in options, show it anyway */
function withSavedValue(value, options) {
  if (!value) return options;
  const exists = options.some((o) => o.value === value);
  if (exists) return options;
  return [{ value, label: `Saved value: ${value}` }, ...options];
}

/* Read-first helper (supports legacy keys if your onboarding saved elsewhere) */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

/* ===========================
   PDF helpers (professional)
=========================== */
function formatDateTime(d) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function formatDate(d) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

function guessImgFormat(dataUrl) {
  const s = String(dataUrl || "");
  if (s.startsWith("data:image/jpeg") || s.startsWith("data:image/jpg"))
    return "JPEG";
  if (s.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function drawLogoKeepRatio(pdf, dataUrl, x, y, maxW, maxH) {
  if (!dataUrl) return { w: 0, h: 0 };

  const props = pdf.getImageProperties(dataUrl);
  const iw = props?.width || 1;
  const ih = props?.height || 1;
  const ratio = iw / ih;

  let w = maxW;
  let h = w / ratio;

  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }

  const fmt = guessImgFormat(dataUrl);
  pdf.addImage(dataUrl, fmt, x, y, w, h);

  return { w, h };
}

async function toDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function drawDivider(pdf, x1, x2, y) {
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(1);
  pdf.line(x1, y, x2, y);
}

function addHeader(pdf, PAGE, opts) {
  const { logoDataUrl, title, subtitle } = opts;
  const headerY = PAGE.t - 46;

  if (logoDataUrl) {
    const maxW = 120;
    const maxH = 28;
    drawLogoKeepRatio(pdf, logoDataUrl, PAGE.l, headerY + 10, maxW, maxH);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title, PAGE.rEdge, headerY + 18, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(subtitle, PAGE.rEdge, headerY + 34, { align: "right" });

  drawDivider(pdf, PAGE.l, PAGE.rEdge, PAGE.t - 12);
}

function addFooter(pdf, PAGE, pageNumber, pageCount) {
  const y = PAGE.h - PAGE.b + 22;

  drawDivider(pdf, PAGE.l, PAGE.rEdge, PAGE.h - PAGE.b + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);

  pdf.text("EcoTrack by Viridis — User Data Export", PAGE.l, y);
  pdf.text(`Page ${pageNumber} / ${pageCount}`, PAGE.rEdge, y, {
    align: "right",
  });
}

function sectionTitle(pdf, PAGE, text, y) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  pdf.text(text, PAGE.l, y);
  return y + 10;
}

/* ===========================
   COMPONENT
=========================== */
export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const [sector, setSector] = useState("");
  const [size, setSize] = useState("");
  const [country, setCountry] = useState("");
  const [turnover, setTurnover] = useState("");
  const [csrd, setCsrd] = useState("");
  const [goal, setGoal] = useState("");
  const [timeline, setTimeline] = useState("");

  // Preferences: in-app reminder only
  const [remindAssessments, setRemindAssessments] = useState(false);

  // Delete account
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) {
        setLoading(false);
        return;
      }

      setEmail(u.email || "");

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const d = snap.data() || {};
        const p = d.profile || {};
        const s = d.settings || {};
        const ob = d.onboarding || d.onboardingProfile || {}; // legacy fallback if you ever used it

        setName(
          pickFirst(d.name, p.name, d.profile?.name, u.email?.split("@")[0], "")
        );

        // IMPORTANT: these pickFirst lines make Profile page resilient
        // even if onboarding saved under different keys earlier.
        setSector(pickFirst(p.sector, d.sector, ob.sector, ""));
        setSize(
          pickFirst(
            p.size,
            d.size,
            d.companySize,
            ob.size,
            ob.companySize,
            ""
          )
        );
        setCountry(pickFirst(p.country, d.country, ob.country, ""));
        setTurnover(
          pickFirst(
            p.turnover,
            d.turnover,
            d.turnoverTier,
            ob.turnover,
            ob.turnoverTier,
            ""
          )
        );
        setCsrd(
          pickFirst(
            p.csrd,
            d.csrd,
            d.csrdStatus,
            ob.csrd,
            ob.csrdStatus,
            ""
          )
        );
        setGoal(pickFirst(p.goal, d.goal, d.goalShort, ob.goal, ""));
        setTimeline(pickFirst(p.timeline, d.timeline, ob.timeline, ""));

        setRemindAssessments(!!s.remindAssessments);
      } else {
        setName(u.email?.split("@")[0] || "");
      }

      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setErr("");
    setMsg("");
    setDeleteErr("");
    setSaving(true);

    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not authenticated");

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      const payload = {
        uid: u.uid,
        email: u.email || "",
        name: name?.trim() || "",
        profile: {
          sector: sector || "",
          size: size || "",
          country: country || "",
          turnover: turnover || "",
          csrd: csrd || "",
          goal: goal || "",
          timeline: timeline || "",
        },
        settings: {
          remindAssessments: !!remindAssessments,
        },
        updatedAt: serverTimestamp(),
      };

      if (!snap.exists()) {
        await setDoc(ref, {
          ...payload,
          onboardingCompleted: true,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, payload);
      }

      setMsg("Profile saved.");
    } catch (e) {
      console.error("Profile save error:", e);
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setErr("");
    setMsg("");
    setDeleteErr("");

    try {
      const u = auth.currentUser;
      const targetEmail = email || u?.email || "";
      if (!targetEmail) throw new Error("No email found for this account.");

      await sendPasswordResetEmail(auth, targetEmail);
      setMsg(`Password reset email sent to ${targetEmail}.`);
    } catch (e) {
      console.error("Password reset error:", e);
      let message = e.message || "Failed to send reset email";

      if (e.code === "auth/invalid-email") {
        message = "The account email address is invalid.";
      } else if (e.code === "auth/user-not-found") {
        message =
          "No user found with this email in Firebase Authentication. Check the email or create the user first.";
      } else if (e.code === "auth/unauthorized-domain") {
        message =
          "This domain is not authorized in Firebase Authentication. Add localhost (or your domain) to the Authorized domains list.";
      } else if (e.code === "auth/operation-not-allowed") {
        message =
          "Email/password sign-in is disabled in Firebase Authentication. Enable it in the console.";
      }

      setErr(message);
    }
  };

  const handleDeleteAccount = async () => {
    setErr("");
    setMsg("");
    setDeleteErr("");

    const u = auth.currentUser;
    if (!u) {
      setDeleteErr("Not authenticated.");
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete your EcoTrack account, including all ESG assessments. This action cannot be undone.\n\nDo you want to continue?"
    );
    if (!confirmed) return;

    setDeleting(true);

    try {
      const uid = u.uid;

      // 1) Delete assessments subcollection (batched safely)
      const assessmentsRef = collection(db, "users", uid, "assessments");
      const snap = await getDocs(assessmentsRef);

      let batch = writeBatch(db);
      let ops = 0;
      const commits = [];

      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        ops++;

        // Batch limit is 500; keep buffer
        if (ops >= 450) {
          commits.push(batch.commit());
          batch = writeBatch(db);
          ops = 0;
        }
      });

      if (ops > 0) commits.push(batch.commit());
      await Promise.all(commits);

      // 2) Delete user document
      await deleteDoc(doc(db, "users", uid));

      // 3) Delete auth user
      await deleteUser(u);

      // 4) Redirect
      window.location.replace("/login");
    } catch (e) {
      console.error("Account delete error:", e);
      if (e.code === "auth/requires-recent-login") {
        setDeleteErr(
          "For security reasons, please log out and log in again, then retry deleting your account."
        );
      } else {
        setDeleteErr("Something went wrong while deleting your account.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadData = async () => {
    setErr("");
    setMsg("");
    setDeleteErr("");
    setExporting(true);

    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not authenticated");
      const uid = u.uid;

      // 1) Get user document
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;

      // 2) Get all assessments
      const assessmentsRef = collection(db, "users", uid, "assessments");
      const assessmentsSnap = await getDocs(assessmentsRef);
      const assessments = [];
      assessmentsSnap.forEach((docSnap) => {
        assessments.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort newest first
      assessments.sort((a, b) => {
        const ad = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bd = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bd - ad;
      });

      // 3) Load logo
      const logoUrl = new URL(
        "../assets/ecotrack-logo.png",
        import.meta.url
      ).href;

      let logoDataUrl = "";
      try {
        logoDataUrl = await toDataUrl(logoUrl);
      } catch {
        logoDataUrl = "";
      }

      // 4) Build PDF
      const pdf = new jsPDF({ compress: true, unit: "pt", format: "a4" });
      pdf.setProperties({
        title: "EcoTrack — Data Export",
        author: "EcoTrack by Viridis",
        subject: "User data export (profile + assessments)",
        creator: "EcoTrack by Viridis",
      });

      const PAGE = {
        w: pdf.internal.pageSize.getWidth(),
        h: pdf.internal.pageSize.getHeight(),
        l: 56,
        r: 56,
        t: 92,
        b: 56,
        get rEdge() {
          return this.w - this.r;
        },
      };

      const exportedAt = new Date();

      addHeader(pdf, PAGE, {
        logoDataUrl,
        title: "EcoTrack — Data Export",
        subtitle: `Exported on ${formatDateTime(exportedAt)}`,
      });

      let y = PAGE.t + 14;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);

      const emailLine = userData?.email || u.email || "-";
      const nameLine = userData?.name || userData?.profile?.name || "-";
      const sectorLine = userData?.profile?.sector || "-";

      pdf.text(`Account: ${emailLine}`, PAGE.l, y);
      y += 16;
      pdf.text(`Name: ${nameLine}`, PAGE.l, y);
      y += 16;
      pdf.text(`Primary sector: ${sectorLine}`, PAGE.l, y);
      y += 16;
      pdf.text(`Total assessments: ${assessments.length}`, PAGE.l, y);
      y += 18;

      drawDivider(pdf, PAGE.l, PAGE.rEdge, y);
      y += 18;

      y = sectionTitle(pdf, PAGE, "User profile", y);

      const profile = userData?.profile || {};
      const settings = userData?.settings || {};

      const profileRows = [
        ["Name", userData?.name || "-"],
        ["Email", userData?.email || "-"],
        ["Country", profile.country || "-"],
        ["Sector", profile.sector || "-"],
        ["Company size", profile.size || "-"],
        ["Turnover", profile.turnover || "-"],
        ["CSRD status", profile.csrd || "-"],
        ["Goal", profile.goal || "-"],
        ["Timeline", profile.timeline || "-"],
        ["Reminder enabled", settings.remindAssessments ? "Yes" : "No"],
      ];

      autoTable(pdf, {
        startY: y + 8,
        head: [["Field", "Value"]],
        body: profileRows,
        theme: "striped",
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 8,
          textColor: [15, 23, 42],
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - 140 },
        },
        margin: { left: PAGE.l, right: PAGE.r },
      });

      y = pdf.lastAutoTable.finalY + 20;

      y = sectionTitle(pdf, PAGE, "Assessments summary", y);

      if (assessments.length === 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(100, 116, 139);
        pdf.text("No ESG assessments found.", PAGE.l, y + 14);
      } else {
        const summaryRows = assessments.map((a) => {
          const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const updatedAt = a.updatedAt?.toDate ? a.updatedAt.toDate() : null;

          const overallPct =
            typeof a.overall === "number"
              ? `${Math.round(a.overall * 100)}%`
              : "-";

          const ps = a.pillarScores || {};
          const ePct =
            typeof ps.E === "number" ? `${Math.round(ps.E * 100)}%` : "-";
          const sPct =
            typeof ps.S === "number" ? `${Math.round(ps.S * 100)}%` : "-";
          const gPct =
            typeof ps.G === "number" ? `${Math.round(ps.G * 100)}%` : "-";

          return [
            a.id,
            a.sector || "-",
            createdAt ? formatDate(createdAt) : "-",
            updatedAt ? formatDate(updatedAt) : "-",
            overallPct,
            ePct,
            sPct,
            gPct,
          ];
        });

        autoTable(pdf, {
          startY: y + 8,
          head: [["ID", "Sector", "Created", "Updated", "Overall", "E", "S", "G"]],
          body: summaryRows,
          theme: "striped",
          styles: {
            fontSize: 9,
            cellPadding: 6,
            overflow: "linebreak",
            valign: "middle",
          },
          headStyles: {
            fillColor: [20, 83, 45],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 110 },
            1: { cellWidth: 90 },
            2: { cellWidth: 60 },
            3: { cellWidth: 60 },
            4: { cellWidth: 52 },
            5: { cellWidth: 34 },
            6: { cellWidth: 34 },
            7: { cellWidth: 34 },
          },
          margin: { left: PAGE.l, right: PAGE.r },
        });
      }

      // Detail pages
      assessments.forEach((a, index) => {
        pdf.addPage();

        addHeader(pdf, PAGE, {
          logoDataUrl,
          title: "EcoTrack — Assessment Detail",
          subtitle: `Exported on ${formatDateTime(exportedAt)}`,
        });

        const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : null;
        const createdStr = createdAt ? formatDateTime(createdAt) : "-";

        let y2 = PAGE.t + 14;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`Assessment ${index + 1}`, PAGE.l, y2);
        y2 += 14;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);

        const overallPct =
          typeof a.overall === "number"
            ? `${Math.round(a.overall * 100)}%`
            : "-";

        const ps = a.pillarScores || {};
        const ePct =
          typeof ps.E === "number" ? `${Math.round(ps.E * 100)}%` : "-";
        const sPct =
          typeof ps.S === "number" ? `${Math.round(ps.S * 100)}%` : "-";
        const gPct =
          typeof ps.G === "number" ? `${Math.round(ps.G * 100)}%` : "-";

        const metaRows = [
          ["Assessment ID", a.id],
          ["Sector", a.sector || "-"],
          ["Created", createdStr],
          ["Overall score", overallPct],
          ["Pillars (E / S / G)", `${ePct} / ${sPct} / ${gPct}`],
        ];

        autoTable(pdf, {
          startY: y2 + 6,
          head: [["Field", "Value"]],
          body: metaRows,
          theme: "grid",
          styles: { fontSize: 10, cellPadding: 7, overflow: "linebreak" },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 150 },
            1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - 150 },
          },
          margin: { left: PAGE.l, right: PAGE.r },
        });

        const answers = a.answers || {};
        const answerRows = Object.entries(answers).map(([key, value]) => {
          const v = value || {};
          const label = v.label || "-";
          const score = typeof v.score === "number" ? v.score : "-";
          return [key, label, score];
        });

        const startAnswersY = pdf.lastAutoTable.finalY + 16;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Answers", PAGE.l, startAnswersY);

        if (answerRows.length === 0) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(100, 116, 139);
          pdf.text("No detailed answers recorded.", PAGE.l, startAnswersY + 14);
        } else {
          autoTable(pdf, {
            startY: startAnswersY + 8,
            head: [["Question ID", "Answer", "Score"]],
            body: answerRows,
            theme: "striped",
            styles: {
              fontSize: 9,
              cellPadding: 6,
              overflow: "linebreak",
              valign: "top",
            },
            headStyles: {
              fillColor: [148, 163, 184],
              textColor: 255,
              fontStyle: "bold",
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { cellWidth: 120 },
              1: { cellWidth: PAGE.w - PAGE.l - PAGE.r - 120 - 50 },
              2: { cellWidth: 50, halign: "center" },
            },
            margin: { left: PAGE.l, right: PAGE.r },
          });
        }
      });

      // Footers
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        addFooter(pdf, PAGE, i, pageCount);
      }

      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`ecotrack-data-${dateStr}.pdf`);

      setMsg("Data exported as PDF.");
    } catch (e) {
      console.error("Data export error:", e);
      setErr(e.message || "Failed to download data.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="landing" style={{ alignItems: "center" }}>
        <main
          className="landing__main"
          style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}
        >
          <TopNav />
          <div>Loading…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="landing" style={{ alignItems: "stretch" }}>
      <main
        className="landing__main"
        style={{ maxWidth: 1200, width: "100%", paddingTop: 80 }}
      >
        <TopNav />

        <div style={{ display: "grid", gap: 16 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <h1 className="landing__title">Profile &amp; Settings</h1>
            <div className="landing__subtitle" style={{ opacity: 0.8 }}>
              Signed in as <b>{email}</b>
            </div>
          </div>

          {/* General */}
          <Card>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              General
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={lbl}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={input}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label style={lbl}>Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={input}
                  placeholder="e.g. Italy"
                />
              </div>

              <div>
                <label style={lbl}>Sector</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  style={input}
                >
                  <option value="">Select…</option>
                  {withSavedValue(sector, SECTORS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={lbl}>Company size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  style={input}
                >
                  <option value="">Select…</option>
                  {withSavedValue(size, SIZE_OPTIONS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={lbl}>Turnover</label>
                <select
                  value={turnover}
                  onChange={(e) => setTurnover(e.target.value)}
                  style={input}
                >
                  <option value="">Select…</option>
                  {withSavedValue(turnover, TURNOVER_OPTIONS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={lbl}>CSRD status</label>
                <select
                  value={csrd}
                  onChange={(e) => setCsrd(e.target.value)}
                  style={input}
                >
                  <option value="">Select…</option>
                  {withSavedValue(csrd, CSRD_OPTIONS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Sustainability goal (short)</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  style={input}
                  placeholder="e.g. compliance"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Timeline</label>
                <input
                  type="text"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  style={input}
                  placeholder="e.g. 6-12"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
                type="button"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            {(msg || err) && (
              <div style={{ marginTop: 10 }}>
                {msg && (
                  <span style={{ color: "#065f46", fontSize: 13 }}>{msg}</span>
                )}
                {err && (
                  <span style={{ color: "#b91c1c", fontSize: 13 }}>{err}</span>
                )}
              </div>
            )}
          </Card>

          {/* Security */}
          <Card>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Security
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                className="btn btn--ghost"
                type="button"
                onClick={handleResetPassword}
              >
                Send password reset email
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                To logout, use the menu in the top-right corner.
              </span>
            </div>

            {/* Danger zone - delete account */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: "#b91c1c",
                }}
              >
                Attention
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 8,
                  maxWidth: 480,
                }}
              >
                Deleting your account will permanently remove your profile and
                all ESG assessments. This action cannot be undone.
              </p>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  borderColor: "#b91c1c",
                  color: "#b91c1c",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Deleting account…" : "Delete my account"}
              </button>
              {deleteErr && (
                <p style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
                  {deleteErr}
                </p>
              )}
            </div>
          </Card>

          {/* Preferences */}
          <Card>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Preferences
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <div style={{ marginTop: 8 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={remindAssessments}
                    onChange={(e) => setRemindAssessments(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Remind me to repeat the ESG assessment periodically</span>
                </label>
                <p
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginTop: 4,
                    marginLeft: 24,
                  }}
                >
                  We&apos;ll show a reminder banner inside EcoTrack when it&apos;s
                  time to repeat your ESG assessment. No emails, and you can
                  disable this at any time.
                </p>
              </div>
            </div>
          </Card>

          {/* Data & Privacy */}
          <Card>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Data &amp; Privacy
            </div>
            <p
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 12,
                maxWidth: 600,
              }}
            >
              You are in control of your data. You can update your profile at any
              time. If you decide to delete your account, all ESG assessments and
              related data stored in EcoTrack will be removed permanently using
              the <strong>Delete my account</strong> option in the Security
              section. You can also download a copy of your data.
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={handleDownloadData}
                disabled={exporting}
              >
                {exporting ? "Preparing download…" : "Download my data"}
              </button>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                Downloads a PDF report with your profile and all ESG assessments.
              </span>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}











