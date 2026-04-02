import { isPublicFirestoreConfigured, securityConfig } from "./config";

export async function getPublicCounterFromFirestore() {
  if (!isPublicFirestoreConfigured) {
    return 0;
  }

  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = import.meta.env.PUBLIC_FIREBASE_API_KEY;
  const documentPath = `${securityConfig.collections.counterCollection}/${securityConfig.collections.counterDoc}`;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}?key=${apiKey}`;

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (response.status === 404) {
    return 0;
  }

  if (!response.ok) {
    throw new Error(`public-firestore-counter-failed:${response.status}`);
  }

  const payload = await response.json();
  const value = payload?.fields?.count;

  if (value?.integerValue !== undefined) {
    return Number(value.integerValue);
  }

  if (value?.doubleValue !== undefined) {
    return Number(value.doubleValue);
  }

  return 0;
}
