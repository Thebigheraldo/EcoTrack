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
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../components/landing.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- helpers ---------- */
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

/* ---------- small UI ---------- */
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

// options
const SECTORS = [
  "Manufacturing",
  "Agriculture/Food",
  "Textile/Fashion",
  "Tech",
  "Finance",
  "Construction",
  "Furniture",
  "Transportation",
];
const SIZES = ["1-10", "11-50", "51-250", "251-1000", "1000+"];
const TURNOVER = ["<€2M", "€2–10M", "€10–50M", "€50–250M", "€250M+"];
const CSRD = ["In scope", "Out of scope", "Unsure"];

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

  const navigate = useNavigate();

  // load user profile
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
        setName(d.name || d.profile?.name || (u.email?.split("@")[0] ?? ""));
        const p = d.profile || {};
        setSector(p.sector || "");
        setSize(p.size || "");
        setCountry(p.country || "");
        setTurnover(p.turnover || "");
        setCsrd(p.csrd || "");
        setGoal(p.goal || "");
        setTimeline(p.timeline || "");

        const s = d.settings || {};
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
      if (!targetEmail) {
        throw new Error("No email found for this account.");
      }

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

      // 1) Delete assessments subcollection
      const assessmentsRef = collection(db, "users", uid, "assessments");
      const snap = await getDocs(assessmentsRef);

      let batch = writeBatch(db);
      let ops = 0;

      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        ops++;
        if (ops === 400) {
          batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      });

      if (ops > 0) {
        await batch.commit();
      }

      // 2) Delete user document
      const userDocRef = doc(db, "users", uid);
      await deleteDoc(userDocRef);

      // 3) Delete auth user
      await deleteUser(u);

      // 4) Redirect to login page (hard reload to avoid onboarding flicker)
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

      // 3) Build PDF
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
        t: 72,
        b: 56,
      };

      // ---- Title ----
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("EcoTrack — Data Export", PAGE.l, PAGE.t);

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const exportedAt = new Date();
      pdf.text(
        `Exported on: ${exportedAt.toLocaleString()}`,
        PAGE.l,
        PAGE.t + 18
      );

      // ---- User profile section ----
      let y = PAGE.t + 40;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("User profile", PAGE.l, y);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      y += 18;

      if (userData) {
        const profile = userData.profile || {};
        const settings = userData.settings || {};

        const lines = [
          `Name: ${userData.name || "-"}`,
          `Email: ${userData.email || "-"}`,
          `Country: ${profile.country || "-"}`,
          `Sector: ${profile.sector || "-"}`,
          `Company size: ${profile.size || "-"}`,
          `Turnover: ${profile.turnover || "-"}`,
          `CSRD status: ${profile.csrd || "-"}`,
          `Goal: ${profile.goal || "-"}`,
          `Timeline: ${profile.timeline || "-"}`,
          `Reminder enabled: ${settings.remindAssessments ? "Yes" : "No"}`,
        ];

        lines.forEach((line) => {
          pdf.text(line, PAGE.l, y);
          y += 14;
        });
      } else {
        pdf.text("No user profile data found.", PAGE.l, y);
        y += 14;
      }

      y += 10;

      // ---- Assessments summary table ----
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Assessments summary", PAGE.l, y);
      y += 12;

      if (assessments.length === 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text("No ESG assessments found.", PAGE.l, y + 10);
      } else {
        const summaryRows = assessments.map((a) => {
          const createdAt =
            a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : null;
          const updatedAt =
            a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate() : null;

          const createdStr = createdAt
            ? createdAt.toLocaleDateString()
            : "-";
          const updatedStr = updatedAt
            ? updatedAt.toLocaleDateString()
            : "-";

          const overallPct =
            typeof a.overall === "number"
              ? Math.round(a.overall * 100) + "%"
              : "-";

          const ps = a.pillarScores || {};
          const ePct =
            typeof ps.E === "number" ? Math.round(ps.E * 100) + "%" : "-";
          const sPct =
            typeof ps.S === "number" ? Math.round(ps.S * 100) + "%" : "-";
          const gPct =
            typeof ps.G === "number" ? Math.round(ps.G * 100) + "%" : "-";

          return [a.id, a.sector || "-", createdStr, overallPct, ePct, sPct, gPct];
        });

        autoTable(pdf, {
          startY: y + 6,
          head: [["ID", "Sector", "Created", "Overall", "E", "S", "G"]],
          body: summaryRows,
          styles: {
            fontSize: 9,
          },
          headStyles: {
            fillColor: [20, 138, 88], // green-ish header
            textColor: 255,
          },
          margin: { left: PAGE.l, right: PAGE.r },
        });
      }

      // ---- Detailed answers per assessment ----
      assessments.forEach((a, index) => {
        pdf.addPage();

        const createdAt =
          a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : null;
        const createdStr = createdAt ? createdAt.toLocaleString() : "-";

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text(`Assessment ${index + 1}: ${a.id}`, PAGE.l, PAGE.t);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text(`Sector: ${a.sector || "-"}`, PAGE.l, PAGE.t + 16);
        pdf.text(`Created: ${createdStr}`, PAGE.l, PAGE.t + 30);

        const overallPct =
          typeof a.overall === "number"
            ? Math.round(a.overall * 100) + "%"
            : "-";
        pdf.text(`Overall score: ${overallPct}`, PAGE.l, PAGE.t + 44);

        const ps = a.pillarScores || {};
        const ePct =
          typeof ps.E === "number" ? Math.round(ps.E * 100) + "%" : "-";
        const sPct =
          typeof ps.S === "number" ? Math.round(ps.S * 100) + "%" : "-";
        const gPct =
          typeof ps.G === "number" ? Math.round(ps.G * 100) + "%" : "-";

        pdf.text(
          `E: ${ePct}   S: ${sPct}   G: ${gPct}`,
          PAGE.l,
          PAGE.t + 58
        );

        const answers = a.answers || {};
        const answerRows = Object.entries(answers).map(([key, value]) => {
          const v = value || {};
          const label = v.label || "";
          const score =
            typeof v.score === "number" ? v.score : "";
          return [key, label, score];
        });

        if (answerRows.length === 0) {
          pdf.text(
            "No detailed answers recorded.",
            PAGE.l,
            PAGE.t + 80
          );
        } else {
          autoTable(pdf, {
            startY: PAGE.t + 80,
            head: [["Question", "Answer label", "Score"]],
            body: answerRows,
            styles: {
              fontSize: 9,
            },
            headStyles: {
              fillColor: [148, 163, 184], // muted gray header
              textColor: 255,
            },
            margin: { left: PAGE.l, right: PAGE.r },
          });
        }
      });

      // 4) Save PDF
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
          style={{
            maxWidth: 1200,
            width: "100%",
            paddingTop: 80, // adjust if needed
          }}
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
        style={{
          maxWidth: 1200,
          width: "100%",
          paddingTop: 80, // adjust if needed
        }}
      >
        {/* 🔝 Menu globale */}
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
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
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
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  {SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  {TURNOVER.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  {CSRD.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  placeholder="e.g. 50% Scope 2 reduction by 2026"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Timeline</label>
                <input
                  type="text"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  style={input}
                  placeholder="e.g. 2025–2027 roadmap"
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
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
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
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#b91c1c",
                  }}
                >
                  {deleteErr}
                </p>
              )}
            </div>
          </Card>

          {/* Preferences (only in-app reminder) */}
          <Card>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Preferences
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 12,
              }}
            >
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
                  <span>
                    Remind me to repeat the ESG assessment periodically
                  </span>
                </label>
                <p
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginTop: 4,
                    marginLeft: 24,
                  }}
                >
                  We&apos;ll show a reminder banner inside EcoTrack when
                  it&apos;s time to repeat your ESG assessment. No emails, and
                  you can disable this at any time.
                </p>
              </div>
            </div>
          </Card>

          {/* Data & Privacy */}
          <Card>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
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
              You are in control of your data. You can update your profile at
              any time. If you decide to delete your account, all ESG
              assessments and related data stored in EcoTrack will be removed
              permanently using the <strong>Delete my account</strong> option in
              the Security section. You can also download a copy of your data.
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
                Downloads a PDF report with your profile and all ESG
                assessments.
              </span>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}










