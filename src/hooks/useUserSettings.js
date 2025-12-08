// src/hooks/useUserSettings.js
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export function useUserSettings() {
  const [settings, setSettings] = useState({
    language: "en",
    benchmarkRegion: "eu",
    remindAssessments: false,
    productUpdates: false,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const u = auth.currentUser;
        if (!u) {
          if (isMounted) setLoadingSettings(false);
          return;
        }

        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          if (isMounted) setLoadingSettings(false);
          return;
        }

        const data = snap.data() || {};
        const s = data.settings || {};

        if (isMounted) {
          setSettings({
            language: s.language || "en",
            benchmarkRegion: s.benchmarkRegion || "eu",
            remindAssessments: !!s.remindAssessments,
            productUpdates: !!s.productUpdates,
          });
          setLoadingSettings(false);
        }
      } catch (err) {
        console.error("useUserSettings error:", err);
        if (isMounted) {
          setSettingsError(err);
          setLoadingSettings(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...settings,
    loadingSettings,
    settingsError,
  };
}
