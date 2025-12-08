import React from "react";
import { NavLink } from "react-router-dom";

export default function AppSidebar({ isLocked, onLockedClick }) {
  const Item = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) => `btn ${isActive ? "btn--primary" : "btn--ghost"}`}
      style={{ width: "100%", justifyContent: "flex-start" }}
    >
      {label}
    </NavLink>
  );

  return (
    <aside style={{ width: 220, display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>EcoTrack</div>
      {Item("/dashboard", "Dashboard")}

      {/* Lock-aware "New Assessment" (same behavior as Dashboard) */}
      {isLocked ? (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onLockedClick}
          style={{ width: "100%", justifyContent: "flex-start" }}
        >
          New Assessment
        </button>
      ) : (
        Item("/sectors", "New Assessment")   // ✅ correct route
      )}

      {Item("/suggestions", "Suggestions")}
      {Item("/profile", "Profile & Settings")}
    </aside>
  );
}
