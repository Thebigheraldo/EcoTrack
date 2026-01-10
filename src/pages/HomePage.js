// src/pages/HomePage.js
import React from "react";
import { useNavigate } from "react-router-dom";
import Landing from "../components/Landing";
import "../components/landing.css";

function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      <Landing
        onLogin={() => navigate("/login")}
        onSignup={() => navigate("/pricing")} // ✅ qui
      />
    </div>
  );
}

export default HomePage;

