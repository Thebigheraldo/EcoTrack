// src/components/Footer.jsx
import React from "react";
import "./landing.css";

const Footer = () => {
  return (
    <footer className="ecotrack-footer">
      <div className="ecotrack-footer__content">
        <p className="ecotrack-footer__disclaimer">
          EcoTrack provides an ESG self-assessment for informational purposes only
          and does not constitute legal, financial or investment advice.
        </p>

        <div className="ecotrack-footer__social">

          {/* LinkedIn */}
          <a
            href="https://www.linkedin.com/company/viridis-esg-sustainability-consultancy"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="ecotrack-footer__icon"
          >
            <svg
              width="18"
              height="18"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5 2.5 2.5 0 0 1 4.98 3.5zM3 9h4v12H3zM14.5 9c-2.33 0-3.5 1.52-3.5 3.08V21h4v-8.1c0-.66.47-1.39 1.5-1.39 1 0 1.5.73 1.5 1.39V21h4v-8.03C22 9.5 19.57 9 18 9c-1.47 0-2.56.63-3.12 1.36h-.06V9h-4.32z"/>
            </svg>
          </a>

          {/* Instagram */}
          <a
            href="https://www.instagram.com/viridis_esg/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="ecotrack-footer__icon"
          >
            <svg
              width="18"
              height="18"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M7 2C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5H7zm10 2c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3h10zm-5 3.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm0 2A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5zm4.8-3.7a1 1 0 1 0 1 1 1 1 0 0 0-1-1z"/>
            </svg>
          </a>

          {/* YouTube */}
          <a
            href="https://www.youtube.com/@ViridisbySerapÇevirgen"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
            className="ecotrack-footer__icon"
          >
            <svg
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M23.5 6.2s-.2-1.6-.8-2.3c-.7-.9-1.5-.9-1.9-1C17.4 2.5 12 2.5 12 2.5h-.1s-5.4 0-8.7.4c-.4.1-1.2.1-1.9 1-.6.7-.8 2.3-.8 2.3S0 7.9 0 9.7v1.6c0 1.8.2 3.6.2 3.6s.2 1.6.8 2.3c.7.9 1.6.9 2 1 1.5.2 6.8.4 8.7.4h.1s5.4 0 8.7-.4c.4-.1 1.2-.1 1.9-1 .6-.7.8-2.3.8-2.3s.2-1.8.2-3.6V9.7c0-1.8-.2-3.5-.2-3.5zM9.5 14.6V7.9l6.3 3.4-6.3 3.3z"/>
            </svg>
          </a>

        </div>
      </div>
    </footer>
  );
};

export default Footer;

