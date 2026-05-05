// src/routes/Guards.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import useUserDoc from "../hooks/useUserDoc";
import { hasActiveEcoTrackSubscription } from "../utils/stripePayments";

function Loader() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "60vh",
        fontSize: 14,
        color: "#475569",
      }}
    >
      Loading…
    </div>
  );
}

function useAuthStateSafe() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, loading };
}

export function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuthStateSafe();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

export function RedirectIfOnboarded() {
  const { user, loading: authLoading } = useAuthStateSafe();
  const { userDoc, loading } = useUserDoc();

  if (authLoading || loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;

  if (userDoc?.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function RequireOnboardingCompleted() {
  const { user, loading: authLoading } = useAuthStateSafe();
  const { userDoc, loading } = useUserDoc();

  if (authLoading || loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;

  if (!userDoc?.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

export function RequireSubscription() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuthStateSafe();
  const { userDoc, loading: userDocLoading } = useUserDoc();

  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSubscription() {
      if (!user) {
        setSubscriptionLoading(false);
        return;
      }

      try {
        // First accept the saved Firestore subscription status.
        if (
          userDoc?.subscriptionStatus === "active" ||
          userDoc?.subscriptionStatus === "trialing"
        ) {
          if (!cancelled) {
            setHasAccess(true);
            setSubscriptionLoading(false);
          }
          return;
        }

        // Then check Stripe directly, with retry.
        for (let i = 0; i < 5; i++) {
          const active = await hasActiveEcoTrackSubscription();

          if (cancelled) return;

          if (active) {
            setHasAccess(true);
            setSubscriptionLoading(false);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (!cancelled) {
          setHasAccess(false);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);

        if (!cancelled) {
          setHasAccess(false);
        }
      } finally {
        if (!cancelled) {
          setSubscriptionLoading(false);
        }
      }
    }

    if (!authLoading && !userDocLoading) {
      checkSubscription();
    }

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, userDoc, userDocLoading]);

  if (authLoading || userDocLoading || subscriptionLoading) return <Loader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAccess) {
    return (
      <Navigate
        to="/checkout"
        replace
        state={{ from: location, reason: "subscription" }}
      />
    );
  }

  return <Outlet />;
}



