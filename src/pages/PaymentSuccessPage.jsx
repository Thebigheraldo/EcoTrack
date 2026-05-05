// src/pages/PaymentSuccessPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import TopNav from "../components/TopNav";
import Footer from "../components/Footer";
import "../components/landing.css";

const ACTIVE_STATUSES = ["active", "trialing"];

function hasActiveSubscription(userData) {
  const status = userData?.subscriptionStatus;

  if (!ACTIVE_STATUSES.includes(status)) return false;

  const currentPeriodEnd = userData?.subscriptionCurrentPeriodEnd;

  if (!currentPeriodEnd) return true;

  const endDate = currentPeriodEnd?.toDate
    ? currentPeriodEnd.toDate()
    : new Date(currentPeriodEnd);

  if (!endDate || Number.isNaN(endDate.getTime())) return true;

  return endDate > new Date();
}

export default function PaymentSuccessPage() {
  const navigate = useNavigate();

  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState(
    "We are confirming your EcoTrack subscription..."
  );

  useEffect(() => {
    let unsubscribeUser = null;
    let timeoutId = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const userRef = doc(db, "users", user.uid);

      unsubscribeUser = onSnapshot(
        userRef,
        (snap) => {
          if (!snap.exists()) {
            setStatus("pending");
            setMessage(
              "Your payment was received, but your account profile is still being prepared."
            );
            return;
          }

          const userData = snap.data();

          if (hasActiveSubscription(userData)) {
            setStatus("active");
            setMessage("Your subscription is active.");
            timeoutId = setTimeout(() => {
              navigate("/dashboard", { replace: true });
            }, 1200);
            return;
          }

          setStatus("pending");
          setMessage(
            "Payment completed. We are waiting for Stripe to confirm your subscription."
          );
        },
        (error) => {
          console.error("[PaymentSuccessPage] Firestore listener error:", error);
          setStatus("error");
          setMessage(
            "We could not verify your subscription automatically. Please contact support if this continues."
          );
        }
      );
    });

    const hardTimeout = setTimeout(() => {
      setStatus((current) => {
        if (current === "active") return current;

        setMessage(
          "The payment may still be processing. If your access is not activated shortly, contact support at info@viridisconsultancy.com."
        );

        return "delayed";
      });
    }, 30000);

    return () => {
      unsubscribeAuth();
      if (typeof unsubscribeUser === "function") unsubscribeUser();
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(hardTimeout);
    };
  }, [navigate]);

  return (
    <div className="landing" style={{ alignItems: "stretch" }}>
      <TopNav />

      <main
        className="landing__main"
        style={{
          maxWidth: 760,
          width: "100%",
          paddingTop: 100,
          textAlign: "center",
        }}
      >
        <section
          className="card"
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 20,
            padding: "36px 28px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "999px",
              margin: "0 auto 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                status === "active"
                  ? "#ECFDF5"
                  : status === "error"
                  ? "#FEF2F2"
                  : "#F8FAFC",
              color:
                status === "active"
                  ? "#047857"
                  : status === "error"
                  ? "#B91C1C"
                  : "#148A58",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {status === "active" ? "✓" : status === "error" ? "!" : "…"}
          </div>

          <h1
            className="landing__title"
            style={{
              color: "#111827",
              fontSize: 30,
              marginBottom: 10,
            }}
          >
            {status === "active"
              ? "Subscription confirmed"
              : status === "error"
              ? "Verification issue"
              : "Checking your subscription"}
          </h1>

          <p
            className="landing__subtitle"
            style={{
              color: "#64748B",
              fontSize: 15,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {message}
          </p>

          {status === "active" ? (
            <Link className="btn btn--primary" to="/dashboard">
              Go to dashboard
            </Link>
          ) : status === "error" || status === "delayed" ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link className="btn btn--primary" to="/dashboard">
                Try dashboard
              </Link>

              <a
                className="btn btn--ghost"
                href="mailto:info@viridisconsultancy.com"
              >
                Contact support
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#94A3B8" }}>
              This usually takes a few seconds.
            </div>
          )}
        </section>

        <Footer />
      </main>
    </div>
  );
}