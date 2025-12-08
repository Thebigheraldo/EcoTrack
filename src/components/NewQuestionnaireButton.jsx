// src/components/NewQuestionnaireButton.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

const MONTHS = 6;
const MS_IN_DAY = 86400000;

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function NewQuestionnaireButton({ onStart, sector }) {
  const [loading, setLoading] = useState(true);
  const [lockedUntil, setLockedUntil] = useState(null);

  useEffect(() => {
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) { setLoading(false); return; }

      try {
        // latest SUBMITTED assessment (any sector)
        const q = query(
          collection(db, "users", uid, "assessments"),
          where("status", "==", "submitted"),
          orderBy("updatedAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data() || {};
          const ts = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;
          if (ts) setLockedUntil(addMonths(ts, MONTHS));
        }
      } catch (e) {
        console.error("[NewQuestionnaireButton] fetch latest failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = new Date();
  const isLocked = lockedUntil && now < lockedUntil;

  let msg = null;
  if (isLocked) {
    const days = Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / MS_IN_DAY));
    msg = `Try again after six months. (~${days} days remaining)`;
  }

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <button
        className="btn btn--primary"
        disabled={loading || isLocked}
        onClick={() => onStart?.(sector)}
        title={isLocked ? msg : undefined}
      >
        {loading ? "Checking…" : "New Questionnaire"}
      </button>
      {isLocked && <span style={{ fontSize:13, color:"#b42318" }}>{msg}</span>}
    </div>
  );
}

