import React from "react";
import { motion } from "framer-motion";
import "./landing.css";

export default function Landing({ onLogin, onSignup }) {
  return (
    <div className="landing">
      {/* background blobs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="landing__blobs"
      >
        <div className="blob blob--left" />
        <div className="blob blob--right" />
      </motion.div>

      <main className="landing__main">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="landing__content"
        >
          <h1 className="landing__title">
            Measure. Improve. <span className="accent">Lead</span>.
          </h1>

          <p className="landing__subtitle">
            ESG self-assessment for SMEs. Get a quick baseline and tailored
            improvement suggestions.
          </p>

          <div className="landing__cta">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn--primary"
              onClick={onLogin}
            >
              Log in
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn--ghost"
              onClick={onSignup}
            >
              Sign up
            </motion.button>
          </div>

          <div className="landing__features">
            {[
              { h: "Quick ESG baseline", p: "20 questions per sector with smart weights." },
              { h: "Tailored suggestions", p: "Actionable tips based on your weakest pillars." },
              { h: "PDF export", p: "One-click report for your team." },
            ].map((c, i) => (
              <motion.div
                key={i}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.08 * i, duration: 0.5 }}
                className="card"
              >
                <h3>{c.h}</h3>
                <p>{c.p}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
