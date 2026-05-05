// src/pages/SignupPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "../components/landing.css";

const LEGAL_LINKS = [
  { to: "/terms-and-conditions", label: "Terms of Use" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/cookie-policy", label: "Cookie Policy" },
  { to: "/dpa", label: "DPA" },
  { to: "/legal-notice", label: "Legal Notice" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const targetPath = useMemo(() => {
    return location.state?.from?.pathname || "/checkout";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [hideLoggedBanner, setHideLoggedBanner] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    setErr("");

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail) return setErr("Please enter your email.");
    if (password.length < 6) {
      return setErr("Password must be at least 6 characters.");
    }

    if (!acceptedLegal) {
      return setErr(
        "You must accept the Terms of Use, Privacy Policy and Refund Policy to create an account."
      );
    }

    setHideLoggedBanner(true);
    setBusy(true);

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName }).catch(
          () => {}
        );
      }

      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email,
          name: trimmedName || "",
          role: "user",
          onboardingCompleted: false,

          legalAccepted: true,
          legalAcceptedAt: serverTimestamp(),
          termsAccepted: true,
          privacyPolicyAccepted: true,
          refundPolicyAcknowledged: true,
          legalVersion: "2026-05",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      navigate(targetPath, { replace: true });
    } catch (e) {
      const map = {
        "auth/email-already-in-use": "Email already registered.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password is too weak.",
        "permission-denied":
          "Account created, but we could not save your profile permissions. Please contact support.",
      };

      setErr(map[e.code] || e.message || "Registration failed.");
      setHideLoggedBanner(false);
    } finally {
      setBusy(false);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="landing" style={{ alignItems: "center" }}>
      <main className="landing__main" style={{ maxWidth: 460 }}>
        <h1 className="landing__title">Create your account</h1>

        <p className="landing__subtitle">
          Save progress and export reports anytime.
        </p>

        {user && !hideLoggedBanner && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              borderRadius: 12,
              fontSize: 14,
              color: "#78350f",
            }}
          >
            You are already logged in as <strong>{user.email}</strong>.

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate(targetPath, { replace: true })}
              >
                Continue
              </button>

              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleLogout}
              >
                Log out to create a new account
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSignup} style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="Full name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl"
            style={inputStyle}
            autoComplete="name"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl"
            style={inputStyle}
            required
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl"
            style={inputStyle}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginTop: 14,
              padding: 12,
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              background: "#F8FAFC",
              fontSize: 13,
              lineHeight: 1.5,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              style={{
                marginTop: 3,
                width: 16,
                height: 16,
                accentColor: "#148A58",
                flexShrink: 0,
              }}
            />

            <span>
              I have read and accept the{" "}
              <Link to="/terms-and-conditions" style={legalInlineLink}>
                Terms of Use
              </Link>
              , the{" "}
              <Link to="/privacy-policy" style={legalInlineLink}>
                Privacy Policy
              </Link>
              , and I acknowledge the{" "}
              <Link to="/refund-policy" style={legalInlineLink}>
                Refund Policy
              </Link>
              .
            </span>
          </label>

          <button
            className="btn btn--primary"
            style={{
              width: "100%",
              marginTop: 12,
              opacity: busy ? 0.75 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            disabled={busy}
            type="submit"
          >
            {busy ? "Creating…" : "Sign up"}
          </button>
        </form>

        {err && (
          <p style={{ color: "#b91c1c", marginTop: 12, fontSize: 14 }}>
            {err}
          </p>
        )}

        <p className="landing__subtitle" style={{ marginTop: 14 }}>
          Already have an account?{" "}
          <Link
            to="/login"
            state={{ from: { pathname: targetPath } }}
            style={{ color: "#059669", textDecoration: "underline" }}
          >
            Log in
          </Link>
        </p>

        <div
          style={{
            marginTop: 26,
            paddingTop: 16,
            borderTop: "1px solid #E2E8F0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "#64748B",
            }}
          >
            Legal documents
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 12,
            }}
          >
            {LEGAL_LINKS.map((item, index) => (
              <React.Fragment key={item.to}>
                <Link
                  to={item.to}
                  style={{
                    color: "#148A58",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </Link>

                {index < LEGAL_LINKS.length - 1 && (
                  <span style={{ color: "#CBD5E1" }}>•</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  marginTop: 8,
};

const legalInlineLink = {
  color: "#148A58",
  fontWeight: 600,
  textDecoration: "underline",
};