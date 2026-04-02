import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import {
  firestore,
  isFirebaseConfigured,
  publicCounterCollection,
  publicCounterDoc
} from "./firebase";

export interface SignaturePayload {
  firstName: string;
  lastName: string;
  rut: string;
  email: string;
  region: string;
  commune: string;
  affiliation: string;
  message: string;
  updates: boolean;
  consent: boolean;
}

export async function submitSignature(collectionName: string, payload: SignaturePayload) {
  if (!isFirebaseConfigured || !firestore) {
    throw new Error("firestore-not-configured");
  }

  const signatureRef = await addDoc(collection(firestore, collectionName), {
    ...payload,
    source: "campaign-site",
    createdAt: serverTimestamp()
  });

  const counterRef = doc(firestore, publicCounterCollection, publicCounterDoc);
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const currentCount = snapshot.exists() ? snapshot.data().count ?? 0 : 0;

    transaction.set(
      counterRef,
      {
        count: Number(currentCount) + 1,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });

  return signatureRef;
}

export async function getSignatureCount() {
  if (!isFirebaseConfigured || !firestore) {
    throw new Error("firestore-not-configured");
  }

  const counterRef = doc(firestore, publicCounterCollection, publicCounterDoc);
  const snapshot = await getDoc(counterRef);
  if (!snapshot.exists()) return 0;
  return Number(snapshot.data().count ?? 0);
}
