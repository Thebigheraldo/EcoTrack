// src/pages/SignupPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null); // ⬅️ utente attuale (se già loggato)
  const [hideLoggedBanner, setHideLoggedBanner] = useState(false); // ⬅️ NEW
  const navigate = useNavigate();

  // Solo osserva lo stato: NIENTE redirect automatico
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    setErr("");

    if (!email.trim()) {
      return setErr("Inserisci l’email.");
    }
    if (password.length < 6) {
      return setErr("Password almeno 6 caratteri.");
    }

    // ⬇️ evita il lampo del banner "sei già loggato" durante la registrazione
    setHideLoggedBanner(true);

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() }).catch(
          () => {}
        );
      }

      // scrivi Firestore in background (non blocca redirect)
      setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email,
          name: name.trim() || "",
          role: "user", // ruolo di default
          onboardingCompleted: false,
          subscriptionStatus: "none",
          subscriptionPlan: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      navigate("/pricing", { replace: true });
    } catch (e) {
      const map = {
        "auth/email-already-in-use": "Email già registrata.",
        "auth/invalid-email": "Email non valida.",
        "auth/weak-password": "Password troppo debole.",
      };
      setErr(map[e.code] || e.message || "Registrazione fallita.");
      // se fallisce, puoi ri-mostrare il banner
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
      <main className="landing__main" style={{ maxWidth: 420 }}>
        <h1 className="landing__title">Create your account</h1>
        <p className="landing__subtitle">
          Save progress and export reports anytime.
        </p>

        {/* Se già loggato: mostra banner di scelta (ma non durante signup in corso) */}
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
                className="btn btn--primary"
                onClick={() =>
                  navigate("/pricing", { replace: true })
                }
              >
                Continua alla pagina pricing
              </button>
              <button className="btn btn--ghost" onClick={handleLogout}>
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

