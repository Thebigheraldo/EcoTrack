// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

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
import EcoTrackLanding from "./pages/EcoTrackLanding";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PricingPage from "./pages/PricingPage";
import CheckoutPage from "./pages/CheckoutPage";
import Onboarding from "./pages/Onboarding";
import IntroPage from "./pages/IntroPage";
import QuestionnaireLoader from "./pages/QuestionnaireLoader";
import Dashboard from "./pages/Dashboard";
import DetailsPage from "./pages/DetailsPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import ProfileSettings from "./pages/ProfileSettings";
import Methodology from "./pages/Methodology";
import CriticalGate from "./pages/CriticalGate";
import AdminDashboard from "./pages/AdminDashboard";

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

          <Route path="/pricing" element={<PricingPage />} /> {/* ✅ PUBLIC */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/critical" element={<CriticalGate />} />

          {/* -------- Auth required -------- */}
          <Route element={<RequireAuth />}>
            {/* Admin */}
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            {/* Non-admin */}
            <Route element={<RequireNonAdmin />}>
              <Route path="/checkout" element={<CheckoutPage />} />

              {/* onboarding only if NOT onboarded */}
              <Route element={<RedirectIfOnboarded />}>
                <Route path="/onboarding" element={<Onboarding />} />
              </Route>

              {/* core app only if onboarded + subscribed */}
              <Route element={<RequireOnboardingCompleted />}>
                <Route element={<RequireSubscription />}>
                  <Route path="/intro" element={<IntroPage />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/questionnaire/:sector" element={<QuestionnaireLoader />} />
                  <Route path="/details/:assessmentId" element={<DetailsPage />} />
                  <Route path="/suggestions" element={<SuggestionsPage />} />
                  <Route path="/methodology" element={<Methodology />} />
                  <Route path="/profile" element={<ProfileSettings />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Fallbacks */}
          <Route path="/results" element={<Navigate to="/dashboard" replace />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}















