// src/components/NewAssessmentButton.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function NewAssessmentButton({
  label = "New assessment",
  className = "",
  style = {},
  sector, // 🔹 REQUIRED to know which questionnaire to start
}) {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null);
  const [recommendedFrom, setRecommendedFrom] = useState(null); // last + 6 months
  const [recommendedBy, setRecommendedBy] = useState(null); // last + 12 months
  const [showDialog, setShowDialog] = useState(false);

  // 🔍 Load last submitted assessment once, to build a reasonable time frame
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setChecking(false);
      return;
    }

    (async () => {
      try {
        const col = collection(db, "users", u.uid, "assessments");

        let snap = await getDocs(
          query(
            col,
            where("status", "==", "submitted"),
            orderBy("updatedAt", "desc"),
            limit(1)
          )
        );

        if (snap.empty) {
          snap = await getDocs(
            query(
              col,
              where("status", "==", "submitted"),
              orderBy("createdAt", "desc"),
              limit(1)
            )
          );
        }

        if (!snap.empty) {
          const data = snap.docs[0].data() || {};
          const ts =
            data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;

          if (ts) {
            setLastSubmittedAt(ts);
            setRecommendedFrom(addMonths(ts, 6));
            setRecommendedBy(addMonths(ts, 12));
          }
        }
      } catch (e) {
        console.warn("[NewAssessmentButton] fetch last assessment failed:", e);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // 👉 This actually starts the new questionnaire
  const handleStartNow = () => {
    if (!sector) {
      alert(
        "No sector is set for this account. Please complete your profile before starting a new assessment."
      );
      navigate("/profile");
      return;
    }

    const slug = encodeURIComponent(sector);
    navigate(`/questionnaire/${slug}`);
  };

  // When user clicks the button in UI → just open dialog
  const handleClick = () => {
    setShowDialog(true);
  };

  const formattedLast =
    lastSubmittedAt && lastSubmittedAt.toLocaleDateString();
  const formattedFrom =
    recommendedFrom && recommendedFrom.toLocaleDateString();
  const formattedBy = recommendedBy && recommendedBy.toLocaleDateString();

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={handleClick}
        disabled={checking}
      >
        {label}
      </button>

      {showDialog && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="modal-card"
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: 24,
              maxWidth: 460,
              width: "90%",
              boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: 18,
                fontWeight: 600,
                color: "#0F172A",
              }}
            >
              When should you repeat the assessment?
            </h2>

            <p
              style={{
                fontSize: 14,
                color: "#475569",
                marginBottom: 8,
              }}
            >
              To keep your ESG results meaningful and comparable over time, a
              reasonable professional practice is to repeat the assessment every{" "}
              <strong>6–12 months</strong>.
            </p>

            {formattedLast ? (
              <p
                style={{
                  fontSize: 13,
                  color: "#475569",
                  marginBottom: 8,
                }}
              >
                Last submitted assessment: <strong>{formattedLast}</strong>.
                <br />
                A balanced window for the next reassessment would be between{" "}
                <strong>{formattedFrom}</strong> and{" "}
                <strong>{formattedBy}</strong>.
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "#475569",
                  marginBottom: 8,
                }}
              >
                This may be your <strong>first</strong> ESG assessment. Once
                completed, repeating it after about{" "}
                <strong>6–12 months</strong> will help you build a reliable
                baseline and trend.
              </p>
            )}

            <ul
              style={{
                fontSize: 13,
                color: "#64748B",
                marginBottom: 16,
                paddingLeft: 18,
              }}
            >
              <li>Don’t repeat it every week: the signal becomes noise.</li>
              <li>
                Consider an extra assessment after major changes (new site,
                merger, new product line).
              </li>
              <li>
                Use the same frequency each year so that trends and benchmarks
                stay consistent.
              </li>
            </ul>

            <p
              style={{
                fontSize: 13,
                color: "#64748B",
                marginBottom: 16,
              }}
            >
              You can still start a new assessment now if you want to monitor
              more frequent progress.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="btn btn--ghost"
                style={{ minWidth: 90 }}
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ minWidth: 140 }}
                onClick={handleStartNow}
              >
                OK, start now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}




