// src/components/TopNav.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import NewAssessmentButton from "./NewAssessmentButton";
import useUserDoc from "../hooks/useUserDoc";
import FeedbackButton from "./FeedbackButton";

const COLORS = {
  primary: "#148A58",
  dark: "#111827",
  muted: "#64748B",
  line: "#E2E8F0",
  bgCard: "#FFFFFF",
};

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null); // wrapper for dropdown area (menu button + dropdown + feedback)

  const { userDoc } = useUserDoc();
  const isAdmin = userDoc?.role === "admin";
  const sector =
    userDoc?.profile?.sector || userDoc?.sector || null; // used by NewAssessmentButton

  const toggleMenu = () => setOpen((v) => !v);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  // 🔹 Close menu when clicking/tapping outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const goHome = () => {
    if (isAdmin) {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        width: "100%",
        maxWidth: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 24px",
        borderRadius: 0,
        borderBottom: `1px solid ${COLORS.line}`,
        background: COLORS.bgCard,
        boxShadow: "0 4px 12px rgba(16,24,40,.06)",
      }}
    >
      {/* Left: logo / title (clickable) */}
      <div
        style={{ display: "flex", flexDirection: "column", cursor: "pointer" }}
        onClick={goHome}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: COLORS.dark,
          }}
        >
          EcoTrack
        </span>
        <span
          style={{
            fontSize: 12,
            color: COLORS.muted,
          }}
        >
          ESG self-assessment for SMEs
        </span>
      </div>

      {/* Right: Feedback + menu button + dropdown */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        ref={menuRef}
      >
        {/* Always-visible feedback entry point */}
        <FeedbackButton />

        {/* Menu button */}
        <button
          type="button"
          onClick={toggleMenu}
          className="btn btn--ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
          }}
        >
          <span>Menu</span>
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <span
              style={{
                width: 14,
                height: 2,
                background: COLORS.dark,
                borderRadius: 999,
              }}
            />
            <span
              style={{
                width: 14,
                height: 2,
                background: COLORS.dark,
                borderRadius: 999,
              }}
            />
          </span>
        </button>

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "110%",
              right: 0,
              minWidth: 220,
              background: "#FFFFFF",
              borderRadius: 12,
              boxShadow: "0 12px 30px rgba(15,23,42,0.18)",
              border: `1px solid ${COLORS.line}`,
              padding: 8,
              zIndex: 1050,
            }}
          >
            {/* ===== ADMIN MENU ===== */}
            {isAdmin ? (
              <>
                <div
                  style={{
                    padding: "4px 8px 6px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.06,
                    color: COLORS.muted,
                  }}
                >
                  Navigation
                </div>

                <MenuLink
                  to="/admin"
                  label="Admin dashboard"
                  onClick={() => setOpen(false)}
                />

                <div
                  style={{
                    borderTop: `1px solid ${COLORS.line}`,
                    marginTop: 6,
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      fontSize: 14,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#B91C1C",
                    }}
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              /* ===== NORMAL USER MENU ===== */
              <>
                <div
                  style={{
                    padding: "4px 8px 6px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.06,
                    color: COLORS.muted,
                  }}
                >
                  Actions
                </div>

                {/* New Assessment */}
                <div style={{ padding: "2px 8px 6px" }}>
                  <NewAssessmentButton
                    label="New Assessment"
                    className="btn btn--primary"
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    sector={sector}
                  />
                </div>

                <div
                  style={{
                    padding: "4px 8px 6px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.06,
                    color: COLORS.muted,
                  }}
                >
                  Navigation
                </div>

                <MenuLink
                  to="/dashboard"
                  label="Dashboard"
                  onClick={() => setOpen(false)}
                />
                <MenuLink
                  to="/suggestions"
                  label="Suggestions"
                  onClick={() => setOpen(false)}
                />
                <MenuLink
                  to="/methodology"
                  label="Methodology"
                  onClick={() => setOpen(false)}
                />
                <MenuLink
                  to="/profile"
                  label="Profile & Settings"
                  onClick={() => setOpen(false)}
                />

                <div
                  style={{
                    borderTop: `1px solid ${COLORS.line}`,
                    marginTop: 6,
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      fontSize: 14,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#B91C1C",
                    }}
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function MenuLink({ to, label, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: "block",
        padding: "8px 10px",
        fontSize: 14,
        textDecoration: "none",
        color: "#111827",
        borderRadius: 8,
      }}
      className="menu-link"
    >
      {label}
    </Link>
  );
}






