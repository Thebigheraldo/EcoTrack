// src/routes/Guards.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import useUserDoc from "../hooks/useUserDoc";

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

/** Stable auth hook (prevents redirect flicker when auth.currentUser is momentarily null). */
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

/**
 * RequireAuth
 * - Waits for auth init.
 * - If not logged in, redirects to /login and preserves intended location.
 */
export function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuthStateSafe();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

/**
 * RedirectIfOnboarded
 * - If onboarding already completed, send the user to /dashboard.
 * - Otherwise, allow access (e.g., the onboarding flow).
 */
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

/**
 * RequireOnboardingCompleted
 * - If onboarding is NOT completed, send the user to /onboarding.
 * - Otherwise, allow access to the requested route.
 */
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

/**
 * RequireSubscription
 * - User must have subscriptionStatus === "active" in user doc.
 * - Otherwise, redirect to /pricing.
 */
export function RequireSubscription() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuthStateSafe();
  const { userDoc, loading } = useUserDoc();

  if (authLoading || loading) return <Loader />;
  if (!user) {
    // safety – normally RequireAuth will already have caught this
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const status = userDoc?.subscriptionStatus || "none";

  if (status !== "active") {
    return (
      <Navigate
        to="/pricing"
        replace
        state={{ from: location, reason: "subscription" }}
      />
    );
  }

  return <Outlet />;
}



