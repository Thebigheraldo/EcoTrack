// src/pages/EcoTrackLanding.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../components/landing.css";

export default function EcoTrackLanding() {
  const navigate = useNavigate();

  const handleStartClick = () => {
    // For now, always go to signup.
    // Later we can add: if logged in + subscribed -> dashboard, etc.
    navigate("/signup");
  };

  return (
    <div className="landing eco-landing-root">
      <TopNav />

      <main className="eco-landing-main">
        {/* HERO */}
        <section className="eco-hero eco-fade-in">
          <div className="eco-hero-left">
            <div className="eco-badge-row">
              <span className="eco-pill">Viridis · EcoTrack</span>
              <span className="eco-pill eco-pill-soft">
                99,99 € / year · Unlimited assessments
              </span>
            </div>

            <h1 className="eco-hero-title">
              Turn ESG complexity into a clear, actionable self-assessment.
            </h1>

            <p className="eco-hero-subtitle">
              EcoTrack helps small and medium businesses understand their ESG
              maturity in 20–30 minutes, using a practical questionnaire based
              on CSRD and ESRS logic — without the consultant jargon.
            </p>

            <div className="eco-hero-cta-row">
              <button onClick={handleStartClick} className="eco-btn-primary">
                Start EcoTrack
              </button>

              <Link to="/login" className="eco-link-secondary">
                Already have an account? Log in
              </Link>
            </div>

            <div className="eco-hero-meta">
              <span>⏱ 20–30 minutes per assessment</span>
              <span>📊 Pillar scores + maturity level</span>
              <span>📄 Downloadable PDF report</span>
            </div>
          </div>

          <div className="eco-hero-right eco-float-card">
            <div className="eco-mini-dashboard">
              <div className="eco-mini-header">
                <span className="eco-mini-label">Demo — Manufacturing SME</span>
                <span className="eco-mini-score">62%</span>
              </div>
              <p className="eco-mini-maturity">Maturity: Developing</p>

              <div className="eco-mini-bars">
                <div className="eco-mini-bar-row">
                  <span>E · Environmental</span>
                  <div className="eco-mini-bar-track">
                    <div
                      className="eco-mini-bar-fill eco-mini-bar-e"
                      style={{ width: "68%" }}
                    />
                  </div>
                  <span className="eco-mini-bar-value">68</span>
                </div>
                <div className="eco-mini-bar-row">
                  <span>S · Social</span>
                  <div className="eco-mini-bar-track">
                    <div
                      className="eco-mini-bar-fill eco-mini-bar-s"
                      style={{ width: "58%" }}
                    />
                  </div>
                  <span className="eco-mini-bar-value">58</span>
                </div>
                <div className="eco-mini-bar-row">
                  <span>G · Governance</span>
                  <div className="eco-mini-bar-track">
                    <div
                      className="eco-mini-bar-fill eco-mini-bar-g"
                      style={{ width: "59%" }}
                    />
                  </div>
                  <span className="eco-mini-bar-value">59</span>
                </div>
              </div>

              <div className="eco-mini-weakspots">
                <p className="eco-mini-weakspots-title">Top weak spots</p>
                <ul>
                  <li>Supplier ESG screening</li>
                  <li>Board oversight on sustainability</li>
                  <li>Formal climate targets</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="eco-section eco-fade-in">
          <h2 className="eco-section-title">What you get with EcoTrack</h2>
          <p className="eco-section-subtitle">
            Not another generic checklist. EcoTrack is structured around real
            ESG pillars, tailored by sector and company profile.
          </p>

          <div className="eco-feature-grid">
            <div className="eco-feature-card">
              <div className="eco-feature-icon">📋</div>
              <h3>Targeted questionnaire</h3>
              <p>
                Questions adapt to your sector and size, focusing on what is
                material for your business instead of a one-size-fits-all list.
              </p>
            </div>

            <div className="eco-feature-card">
              <div className="eco-feature-icon">📊</div>
              <h3>Clear ESG scores</h3>
              <p>
                See Environmental, Social and Governance scores, plus internal
                breakdowns and benchmarks against typical sector averages.
              </p>
            </div>

            <div className="eco-feature-card">
              <div className="eco-feature-icon">🎯</div>
              <h3>Maturity level</h3>
              <p>
                Instantly understand where you stand: Beginner, Developing,
                Advanced or Leading — with context for each level.
              </p>
            </div>

            <div className="eco-feature-card">
              <div className="eco-feature-icon">🧭</div>
              <h3>Actionable next steps</h3>
              <p>
                Automatically generated suggestions highlight your top weak
                areas and practical improvements you can start immediately.
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS / STEPS */}
        <section className="eco-section eco-fade-in">
          <h2 className="eco-section-title">How EcoTrack works</h2>

          <div className="eco-steps">
            <div className="eco-step">
              <span className="eco-step-badge">1</span>
              <div>
                <h3>Set your profile</h3>
                <p>
                  Select your sector, size and a few basic details. EcoTrack
                  uses this to weight the questions and ESG pillars.
                </p>
              </div>
            </div>

            <div className="eco-step">
              <span className="eco-step-badge">2</span>
              <div>
                <h3>Answer the assessment</h3>
                <p>
                  Go through Environmental, Social and Governance questions.
                  Most users complete a first pass in about 20–30 minutes.
                </p>
              </div>
            </div>

            <div className="eco-step">
              <span className="eco-step-badge">3</span>
              <div>
                <h3>Review your scores</h3>
                <p>
                  See your ESG scores, maturity level, and how you compare to
                  typical peers in your sector.
                </p>
              </div>
            </div>

            <div className="eco-step">
              <span className="eco-step-badge">4</span>
              <div>
                <h3>Download your PDF report</h3>
                <p>
                  Export a clean report you can share internally or use as a
                  starting point for strategy and reporting work.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="eco-section eco-fade-in">
          <h2 className="eco-section-title">Who is EcoTrack for?</h2>
          <div className="eco-two-column">
            <ul className="eco-list">
              <li>SMEs that need a first ESG diagnosis before a full audit.</li>
              <li>
                Companies starting to navigate CSRD / ESRS but not ready for a
                Big4-style project.
              </li>
              <li>
                Owners, CFOs and sustainability leads who need a structured
                conversation starter with management.
              </li>
            </ul>
            <ul className="eco-list">
              <li>
                Businesses that want to track improvement by running the
                assessment periodically.
              </li>
              <li>
                Consultants and advisors who need a simple tool to pre-assess
                clients before deeper work.
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="eco-section eco-fade-in">
          <h2 className="eco-section-title">FAQ</h2>

          <div className="eco-faq-item">
            <h3>How long does an assessment take?</h3>
            <p>
              A first honest pass usually takes 20–30 minutes. You can always
              come back, refine answers and add more information as your ESG
              work evolves.
            </p>
          </div>

          <div className="eco-faq-item">
            <h3>What do I get at the end?</h3>
            <p>
              A dashboard with ESG pillar scores, maturity level, top weak
              spots, tailored suggestions and a downloadable PDF report.
            </p>
          </div>

          <div className="eco-faq-item">
            <h3>Is my data private?</h3>
            <p>
              Yes. Your answers are stored only to generate and update your own
              EcoTrack assessments. They are not shared with third parties.
            </p>
          </div>
        </section>

        {/* BOTTOM CTA BAR */}
        <section className="eco-bottom-cta eco-fade-in">
          <div>
            <h2>Ready to run your first ESG self-assessment?</h2>
            <p>
              Create your account and get a structured view of where you stand
              today — and what to improve next.
            </p>
          </div>
          <button onClick={handleStartClick} className="eco-btn-primary">
            Start EcoTrack
          </button>
        </section>
      </main>
    </div>
  );
}

