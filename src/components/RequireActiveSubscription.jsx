import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

function isSubscriptionActive(subscriptionStatus) {
  return subscriptionStatus === "active" || subscriptionStatus === "trialing";
}

export default function RequireActiveSubscription({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setRole(data.role || "user");
          setSubscriptionStatus(data.subscriptionStatus || "inactive");
        } else {
          setRole("user");
          setSubscriptionStatus("inactive");
        }
      } catch (e) {
        console.error("RequireActiveSubscription: error reading user doc", e);
        setRole("user");
        setSubscriptionStatus("inactive");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) {
    // Semplice placeholder: puoi sostituirlo con spinner UI tua
    return (
      <div style={{ padding: 24 }}>
        <p>Loading…</p>
      </div>
    );
  }

  // Non loggato → login (salvo "dove stava andando")
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Admin bypass (se vuoi)
  if (role === "admin") {
    return children;
  }

  // Non attivo → pricing (salvo "dove stava andando")
  const active = isSubscriptionActive(subscriptionStatus);
  if (!active) {
    return <Navigate to="/pricing" replace state={{ from: location }} />;
  }

  return children;
}
