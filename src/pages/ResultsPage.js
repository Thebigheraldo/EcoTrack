// src/pages/ResultsPage.js
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

function ResultsPage() {
  const location = useLocation();
  const { sector } = useParams();
  const navigate = useNavigate();
  const answers = location.state?.answers || [];

  console.log("Sector:", sector);
  console.log("Answers:", answers);

  return (
    <div className="App fade-in">
      <header className="App-header">Your Answers – {sector}</header>

      <main className="App-main">
        <div className="results-list">
          {answers.map((entry, index) => (
            <div key={index} className="card suggestion-card">
              <strong>Q{index + 1}:</strong>{" "}
              {typeof entry.question === 'string'
                ? entry.question
                : entry.question?.question}
              <br />
              <strong>A:</strong> {entry.answer}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <button
            className="start-button"
            onClick={() =>
              navigate(`/questionnaire/${sector}/details`, {
                state: { answers },
              })
            }
          >
            View Details
          </button>
        </div>
      </main>
    </div>
  );
}

export default ResultsPage;