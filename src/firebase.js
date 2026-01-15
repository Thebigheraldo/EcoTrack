// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// ⬇️ paste your real config from Firebase Console → Project settings → Web app
const firebaseConfig = {
  apiKey: "AIzaSyBnnlTxAitNX-dFPqfldKBzfaZcjJc9SDI",
  authDomain: "eco-track-1f465.firebaseapp.com",
  projectId: "eco-track-1f465",
  storageBucket: "eco-track-1f465.firebasestorage.app",
  messagingSenderId: "702250111069",
  appId: "1:702250111069:web:09d11d01769673616e7db4",
  measurementId: "G-V2NLBSDM7D"
};

// Optional: crash early if missing (prevents silent broken prod deploys)
Object.entries(firebaseConfig).forEach(([k, v]) => {
  if (!v) {
    throw new Error(`Missing Firebase env var for ${k}. Check your .env.local`);
  }
});

const app = initializeApp(firebaseConfig);

// 👉 THIS is the named export everyone is importing
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");

// (optional) export the app too
export default app;
