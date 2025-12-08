import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

export const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export async function getLatestAssessment(docRefUser, db) {
  const colRef = collection(db, `users/${docRefUser.uid}/assessments`);
  const q = query(colRef, orderBy("createdAt", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export function isCooldownActive(latestAssessment) {
  if (!latestAssessment?.createdAt) return false;
  const createdAt = latestAssessment.createdAt.toMillis
    ? latestAssessment.createdAt.toMillis()
    : new Date(latestAssessment.createdAt).getTime();
  return Date.now() - createdAt < SIX_MONTHS_MS;
}
