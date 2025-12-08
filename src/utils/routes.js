// Central source of truth for routes
export const ROUTES = {
  DASHBOARD: "/dashboard",
  SUGGESTIONS: "/suggestions",
  PROFILE: "/profile",
  START_ASSESSMENT: "/start",        // <- use this everywhere for New Assessment
  ASSESSMENT_ONBOARDING: "/onboarding", // your new first step (not the old sector page)
  QUESTIONNAIRE: "/questionnaire",   // current questionnaire entry
  // Remove old/legacy routes like "/sector" everywhere
};
