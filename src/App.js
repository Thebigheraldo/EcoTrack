// src/App.js
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  RequireAuth,
  RequireOnboardingCompleted,
  RedirectIfOnboarded,
  RequireSubscription,
} from "./routes/Guards";

import RequireAdmin from "./components/RequireAdmin";
import RequireNonAdmin from "./components/RequireNonAdmin";

// PAGES
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import IntroPage from "./pages/IntroPage";

import QuestionnaireLoader from "./pages/QuestionnaireLoader";
import Dashboard from "./pages/Dashboard";
import DetailsPage from "./pages/DetailsPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import Onboarding from "./pages/Onboarding";
import ProfileSettings from "./pages/ProfileSettings";
import CriticalGate from "./pages/CriticalGate";
import Methodology from "./pages/Methodology";
import AdminDashboard from "./pages/AdminDashboard";

import EcoTrackLanding from "./pages/EcoTrackLanding";
import PricingPage from "./pages/PricingPage";
import CheckoutPage from "./pages/CheckoutPage"; // ⬅️ NEW

import AuthProvider from "./auth/AuthProvider";

import "./App.css";
import "./index.css";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* -------- Public -------- */}
          <Route path="/" element={<HomePage />} />
          <Route path="/ecotrack" element={<EcoTrackLanding />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/critical" element={<CriticalGate />} />

          {/* -------- Auth-only but BEFORE full onboarding (NORMAL USERS ONLY) -------- */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireNonAdmin />}>
              {/* pricing + checkout visible to any logged-in non-admin */}
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/checkout" element={<CheckoutPage />} /> {/* ⬅️ NEW */}

              {/* If user already completed onboarding, RedirectIfOnboarded sends them to /dashboard */}
              <Route element={<RedirectIfOnboarded />}>
                <Route path="/onboarding" element={<Onboarding />} />
              </Route>
            </Route>
          </Route>

          {/* -------- Auth + Onboarding completed (NORMAL USERS ONLY) -------- */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireOnboardingCompleted />}>
              <Route element={<RequireNonAdmin />}>
                <Route element={<RequireSubscription />}>
                  <Route path="/intro" element={<IntroPage />} />

                  <Route
                    path="/questionnaire/:sector"
                    element={<QuestionnaireLoader />}
                  />

                  <Route path="/dashboard" element={<Dashboard />} />

                  <Route
                    path="/details/:assessmentId"
                    element={<DetailsPage />}
                  />

                  <Route path="/suggestions" element={<SuggestionsPage />} />
                  <Route path="/methodology" element={<Methodology />} />
                  <Route path="/profile" element={<ProfileSettings />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* -------- Admin-only area -------- */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
          </Route>

          {/* Legacy redirect */}
          <Route path="/results" element={<Navigate to="/dashboard" replace />} />

          {/* Fallbacks */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}














