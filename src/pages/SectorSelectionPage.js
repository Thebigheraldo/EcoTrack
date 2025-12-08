import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const sectors = [
  "Manufacturing",
  "AgricultureFood",
  "TextileFashion",
  "Tech",
  "Finance",
  "Construction",
  "Furniture",
  "Transportation",
];

function SectorSelectionPage() {
  const navigate = useNavigate();
  const [selectedSector, setSelectedSector] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleStart = () => {
    if (selectedSector) {
      setShowModal(true);
    }
  };

  const handleProceed = () => {
    setShowModal(false);
    navigate(`/questionnaire/${selectedSector}`);
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <div className="App fade-in">
      <header className="App-header">Select Your Sector</header>
      <main className="App-main">
        <div className="sector-form">
          <select
            className="sector-dropdown"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            <option value="">-- Choose a sector --</option>
            {sectors.map((sector, index) => (
              <option key={index} value={sector}>
                {sector}
              </option>
            ))}
          </select>
          <button
            className="start-button"
            onClick={handleStart}
            disabled={!selectedSector}
          >
            Start
          </button>
        </div>
      </main>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>
              For a more realistic result, make sure you answer honestly to each question.
            </p>
            <div className="modal-buttons">
              <button onClick={handleProceed}>Proceed</button>
              <button onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SectorSelectionPage;
