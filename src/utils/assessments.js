import { auth, db } from "../firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";

// Crea un nuovo assessment ogni volta
export async function createAssessment(sector) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not authenticated");

  const colRef = collection(db, "users", u.uid, "assessments");
  const docRef = await addDoc(colRef, {
    sector,
    status: "draft",
    answers: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// Salvataggio progressivo o finale
export async function saveAnswers(assessmentId, answers, status = "draft") {
  const u = auth.currentUser;
  if (!u) throw new Error("Not authenticated");

  const ref = doc(db, "users", u.uid, "assessments", assessmentId);
  await updateDoc(ref, {
    answers,
    status,
    updatedAt: serverTimestamp(),
  });
}
