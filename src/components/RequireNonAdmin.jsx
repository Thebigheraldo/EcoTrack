// src/components/RequireNonAdmin.jsx
import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useUserDoc } from "../hooks/useUserDoc";

export default function RequireNonAdmin() {
  const { userDoc, loading } = useUserDoc();

  if (loading) {
    return <div className="centered">Loading...</div>;
  }

  // If this is an admin account, do NOT allow access to normal user routes
  if (userDoc?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  // Normal user → proceed
  return <Outlet />;
}
