// src/components/RequireAdmin.jsx
import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useUserDoc } from "../hooks/useUserDoc";

export default function RequireAdmin() {
  const { firebaseUser, userDoc, loading } = useUserDoc();

  if (loading) {
    return <div className="centered">Loading...</div>;
  }

  // Not logged in → to login
  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not admin
  if (userDoc?.role !== "admin") {
    return <div className="centered">Not authorized.</div>;
  }

  // Admin → render nested routes
  return <Outlet />;
}

