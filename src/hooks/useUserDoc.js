// src/hooks/useUserDoc.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * Hook that keeps track of:
 * - firebaseUser  (from Firebase Auth)
 * - userDoc       (document in /users/{uid})
 * - loading       (true while either is being resolved)
 */
export function useUserDoc() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // listen to auth changes
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u || null);

      if (!u) {
        // not logged in
        setUserDoc(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (err) {
        console.error("Error loading user doc", err);
        setUserDoc(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { firebaseUser, userDoc, loading };
}

// keep compatibility with existing default imports
export default useUserDoc;

