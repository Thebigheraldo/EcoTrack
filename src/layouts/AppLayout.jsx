// src/layouts/AppLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";

export default function AppLayout() {
  return (
    <>
      <TopNav hideOnRoutes />
      <Outlet />
    </>
  );
}
