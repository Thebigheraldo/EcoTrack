import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";

function isSubscriptionActive(status) {
  return status === "active" || status === "trialing";
}

export default function RequireActiveSubscription({ children }) {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u || null);

      if (!u) {
        setRole("user");
        setHasActiveSubscription(false);
        setLoading(false);
        return;
      }

      try {
        // 1) Read role from users/{uid}
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setRole(userData.role || "user");
        } else {
          setRole("user");
        }

        // 2) Read Stripe subscriptions from customers/{uid}/subscriptions
        const subsRef = collection(db, "customers", u.uid, "subscriptions");
        const subsSnap = await getDocs(subsRef);

        const activeSub = subsSnap.docs.some((docSnap) => {
          const data = docSnap.data();
          return isSubscriptionActive(data.status);
        });

        setHasActiveSubscription(activeSub);
      } catch (error) {
        console.error(
          "RequireActiveSubscription: error reading subscription data",
          error
        );
        setRole("user");
        setHasActiveSubscription(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Loading…</p>
      </div>
    );
  }

  // Not logged in → login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Admin bypass
  if (role === "admin") {
    return children;
  }

  // No active Stripe subscription → checkout
  if (!hasActiveSubscription) {
    return <Navigate to="/checkout" replace state={{ from: location }} />;
  }

  return children;
}