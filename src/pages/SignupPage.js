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

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Se arrivi da pricing con state.from = /checkout, qui lo prendi
  const targetPath = useMemo(() => {
    return location.state?.from?.pathname || "/checkout";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [hideLoggedBanner, setHideLoggedBanner] = useState(false);

  // Solo osserva lo stato: NIENTE redirect automatico
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    setErr("");

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail) return setErr("Inserisci l’email.");
    if (password.length < 6) return setErr("Password almeno 6 caratteri.");

    // evita il lampo del banner durante la registrazione
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

      // Firestore (non bloccare)
      setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email,
          name: trimmedName || "",
          role: "user",
          onboardingCompleted: false,
          subscriptionStatus: "none",
          subscriptionPlan: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      // ✅ FIX: dopo signup vai dove dovevi andare (di default /checkout)
      navigate(targetPath, { replace: true });
    } catch (e) {
      const map = {
        "auth/email-already-in-use": "Email già registrata.",
        "auth/invalid-email": "Email non valida.",
        "auth/weak-password": "Password troppo debole.",
      };
      setErr(map[e.code] || e.message || "Registrazione fallita.");
      setHideLoggedBanner(false);
    } finally {
      setBusy(false);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      // dopo logout resta su signup (così può creare un nuovo account)
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="landing" style={{ alignItems: "center" }}>
      <main className="landing__main" style={{ maxWidth: 420 }}>
        <h1 className="landing__title">Create your account</h1>
        <p className="landing__subtitle">
          Save progress and export reports anytime.
        </p>

        {/* Se già loggato: scelta (ma non durante signup in corso) */}
        {user && !hideLoggedBanner && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              borderRadius: 12,
              fontSize: 14,
            }}
          >
            Sei già loggato come <strong>{user.email}</strong>.
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate(targetPath, { replace: true })}
              >
                Continua
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleLogout}
              >
                Esci per creare un nuovo account
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

          <button
            className="btn btn--primary"
            style={{ width: "100%", marginTop: 8 }}
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


