import { isPublicFirestoreConfigured, securityConfig } from "./config";

export async function getPublicCounterFromFirestore() {
  const counter = await getPublicCounterBreakdownFromFirestore();
  return counter.count;
}

export async function getPublicCounterBreakdownFromFirestore() {
  if (!isPublicFirestoreConfigured) {
    return {
      count: 0,
      chileanCount: 0,
      foreignCount: 0
    };
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
    return {
      count: 0,
      chileanCount: 0,
      foreignCount: 0
    };
  }

  if (!response.ok) {
    throw new Error(`public-firestore-counter-failed:${response.status}`);
  }

  const payload = await response.json();
  const toNumber = (value: any) => {
    if (value?.integerValue !== undefined) return Number(value.integerValue);
    if (value?.doubleValue !== undefined) return Number(value.doubleValue);
    return 0;
  };

  return {
    count: toNumber(payload?.fields?.count),
    chileanCount: toNumber(payload?.fields?.chileanCount),
    foreignCount: toNumber(payload?.fields?.foreignCount)
  };
}
