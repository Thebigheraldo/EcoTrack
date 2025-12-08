import React from "react";
import { Navigate } from "react-router-dom";
import useUserDoc from "../hooks/useUserDoc"; // l'hook che ti ho passato prima
import { getQuestionsForSector } from "../utils/questions";
import Questionnaire from "./Questionnaire";

function Loader() {
  return (
    <div style={{ display:"grid", placeItems:"center", height:"60vh", color:"#475569" }}>
      Loading…
    </div>
  );
}

export default function QuestionnaireLoader() {
  const { userDoc, loading } = useUserDoc();
  if (loading) return <Loader />;

  const sector = userDoc?.profile?.sector;
  if (!sector) return <Navigate to="/onboarding" replace />;

  const questions = getQuestionsForSector(sector);
  if (!questions.length) {
    return (
      <div className="landing" style={{ alignItems: "center" }}>
        <main className="landing__main" style={{ maxWidth: 720 }}>
          <h1 className="landing__title">ESG Assessment</h1>
          <p className="landing__subtitle">Sector: {sector}</p>
          <div className="card" style={{ padding:16, border:"1px solid #e2e8f0", borderRadius:16 }}>
            Nessuna domanda trovata per questo settore. Controlla <code>utils/questions.js</code>.
          </div>
        </main>
      </div>
    );
  }

  return <Questionnaire questions={questions} sector={sector} />;
}
