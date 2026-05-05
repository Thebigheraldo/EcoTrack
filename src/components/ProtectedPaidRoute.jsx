import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { hasPaidEcoTrackAccess } from "../utils/ecotrackBilling";

export default function ProtectedPaidRoute({ children }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const user = auth.currentUser;

      if (!user) {
        if (!cancelled) setState("unauthenticated");
        return;
      }

      try {
        const paid = await hasPaidEcoTrackAccess(user.uid);
        if (!cancelled) {
          setState(paid ? "paid" : "unpaid");
        }
      } catch (error) {
        console.error("Error checking paid access:", error);
        if (!cancelled) setState("unpaid");
      }
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (state === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (state === "unpaid") {
    return <Navigate to="/checkout" replace />;
  }

  return children;
}