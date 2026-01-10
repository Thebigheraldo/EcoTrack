import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import "../components/landing.css";

function isSubscriptionActive(subscriptionStatus) {
  // Adatta a come vuoi gestire i piani
  return subscriptionStatus === "active" || subscriptionStatus === "trialing";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // dove voleva andare l’utente prima di essere rimandato al login
  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);

    try {
      // 1) Auth login
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const uid = cred.user.uid;

      // 2) Load user doc (role + onboarding + subscription)
      let role = "user";
      let onboardingCompleted = false;
      let subscriptionStatus = "inactive";

      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          role = data.role || "user";
          onboardingCompleted = !!data.onboardingCompleted;
          subscriptionStatus = data.subscriptionStatus || "inactive";
        }
      } catch (e) {
        console.error("Error reading user doc on login", e);
        // fallback safe: treat as non-subscribed
      }

      // 3) Routing logic
      if (role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      const active = isSubscriptionActive(subscriptionStatus);

      // Se non è attivo → pricing
      if (!active) {
        navigate("/pricing", { replace: true, state: { from: { pathname: from } } });
        return;
      }

      // Se è attivo ma non ha completato onboarding → onboarding
      if (!onboardingCompleted) {
        navigate("/onboarding", { replace: true });
        return;
      }

      // Utente attivo + onboarded → torna dove voleva andare (o dashboard)
      navigate(from, { replace: true });
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setErr("");
    setInfo("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErr('Please enter your email and then click "Forgot my password".');
      return;
    }

    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setInfo("Password reset email sent. Check your inbox (and spam folder).");
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to send password reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing" style={{ alignItems: "center" }}>
      <main className="landing__main" style={{ maxWidth: 420 }}>
        <h1 className="landing__title">Welcome back</h1>
        <p className="landing__subtitle">Log in to access your assessments.</p>

        <form onSubmit={handleLogin} style={{ marginTop: 16 }}>
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl"
            style={inputStyle}
            required
            autoComplete="current-password"
          />

          <button
            className="btn btn--primary"
            style={{ width: "100%", marginTop: 8 }}
            disabled={busy}
            type="submit"
          >
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ width: "100%" }}
            onClick={handleForgotPassword}
            disabled={busy}
          >
            Forgot my password
          </button>
        </div>

        {err && (
          <p style={{ color: "#b91c1c", marginTop: 12, fontSize: 14 }}>
            {err}
          </p>
        )}
        {info && (
          <p style={{ color: "#059669", marginTop: 8, fontSize: 14 }}>
            {info}
          </p>
        )}

        {/* Niente "Sign up" qui: funnel a pagamento → manda ai piani */}
        <p className="landing__subtitle" style={{ marginTop: 14 }}>
          First time here?{" "}
          <Link
            to="/pricing"
            style={{ color: "#059669", textDecoration: "underline" }}
          >
            See plans & subscribe
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



