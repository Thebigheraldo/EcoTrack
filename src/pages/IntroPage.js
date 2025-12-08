// src/pages/IntroPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faLinkedin, faInternetExplorer } from '@fortawesome/free-brands-svg-icons';
import { faGlobe } from '@fortawesome/free-solid-svg-icons';





function IntroPage() {
  const navigate = useNavigate();
  
  return (
    <div className="App fade-in">
      <header className="App-header">
        What is EcoTrack?
      </header>
      <div className="App-description">
  <p>EcoTrack helps your business measure</p>
  <p>and improve its sustainability performance.</p>
  <p><br /></p>
  <p>Start the questionnaire to get your ESG score</p>
  <p>or explore personalized tips to boost your impact!</p>
</div>


      <main className="App-main intro-buttons">
      <button className="start-button" onClick={() => navigate('/sectors')}>
  Start Questionnaire
</button>
        <button className="outline-button" onClick={() => navigate('/suggestions')}>
  See Suggestions
</button>

      </main>

      <footer className="social-footer">
  <a href="https://www.viridisconsultancy.com" target="_blank" rel="noopener noreferrer">
    <FontAwesomeIcon icon={faGlobe} size="2x" />
  </a>
  <a href="https://www.linkedin.com/company/viridis-esg-sustainability-consultancy/posts/?feedView=all" target="_blank" rel="noopener noreferrer">
    <FontAwesomeIcon icon={faLinkedin} size="2x" />
  </a>
  <a href="https://www.instagram.com/viridis_esg/" target="_blank" rel="noopener noreferrer">
    <FontAwesomeIcon icon={faInstagram} size="2x" />
  </a>
</footer>

    </div>
  );
}

export default IntroPage;