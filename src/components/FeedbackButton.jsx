// src/components/FeedbackButton.jsx
import React, { useState } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 50,
};

const modalStyle = {
  width: "100%",
  maxWidth: 420,
  background: "#FFFFFF",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 20px 40px rgba(15,23,42,0.35)",
};

const FeedbackButton = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const user = auth.currentUser;

  const handleOpen = () => {
    setOpen(true);
    setError("");
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    setMessage("");
    setEmail("");
    setSubmitted(false);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please write a short feedback message.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const feedbackRef = collection(db, "feedback");
      await addDoc(feedbackRef, {
        message: message.trim(),
        page: typeof window !== "undefined" ? window.location.pathname : null,
        userId: user ? user.uid : null,
        userEmail: user ? user.email : email.trim() || null,
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
      setMessage("");
      // don't auto-close immediately: let them see the confirmation
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      console.error("Error sending feedback:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* TopNav button */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          border: "1px solid #E2E8F0",
          borderRadius: 9999,
          padding: "6px 12px",
          fontSize: 12,
          background: "#FFFFFF",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 14 }}>💬</span>
        <span>Feedback</span>
      </button>

      {/* Modal */}
      {open && (
        <div style={overlayStyle} onClick={handleClose}>
          <div
            style={modalStyle}
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
          >
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>Help us improve EcoTrack</h2>
              <p style={{ fontSize: 13, color: "#64748B" }}>
                Share what works, what&apos;s confusing, or what you&apos;d like to see next.
              </p>
            </div>

            {submitted ? (
              <div
                style={{
                  padding: 8,
                  borderRadius: 8,
                  background: "#ECFDF3",
                  border: "1px solid #BBF7D0",
                  fontSize: 14,
                }}
              >
                Thank you for your feedback!
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Your feedback
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={600}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                      resize: "vertical",
                    }}
                    placeholder="What should we improve, fix or add?"
                  />
                </label>

                {!user && (
                  <label style={{ fontSize: 13 }}>
                    Optional email for follow-up
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: "100%",
                        marginTop: 4,
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        fontSize: 13,
                      }}
                      placeholder="your@email.com (optional)"
                    />
                  </label>
                )}

                {error && (
                  <p style={{ color: "#DC2626", fontSize: 12, marginTop: 4 }}>{error}</p>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 9999,
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      fontSize: 12,
                      cursor: submitting ? "default" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 9999,
                      border: "none",
                      background: submitting ? "#16A34A80" : "#16A34A",
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: submitting ? "default" : "pointer",
                    }}
                  >
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            )}

            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "#94A3B8",
              }}
            >
              This form is for product feedback only. For support, you can email{" "}
              <a href="mailto:info@viridisconsultancy.com">info@viridisconsultancy.com</a>.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
