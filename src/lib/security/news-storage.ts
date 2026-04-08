import { securityConfig } from "./config";
import { commitWrites, createDocument, encodeDelete, encodeWrite, getDocument, queryCollection } from "./firestore-rest";

export interface NewsRecord {
  id: string;
  title: string;
  body: string;
  preference: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export async function listNews() {
  const rows = await queryCollection<NewsRecord>({
    collectionId: securityConfig.collections.news,
    limit: 200
  });

  return rows.sort((a, b) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0));
}

export async function getNewsItem(id: string) {
  const record = await getDocument<NewsRecord>(`${securityConfig.collections.news}/${id}`);
  if (!record) return null;
  const { id: storedId, ...rest } = record as NewsRecord & { id?: string };
  return { id: storedId ?? id, ...rest };
}

export async function createNewsItem(input: { title: string; body: string }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await createDocument(`${securityConfig.collections.news}/${id}`, {
    title: input.title,
    body: input.body,
    preference: 0,
    createdAtMs: now,
    updatedAtMs: now
  });

  return { id, title: input.title, body: input.body, preference: 0, createdAtMs: now, updatedAtMs: now };
}

export async function updateNewsItem(input: {
  id: string;
  title: string;
  body: string;
  preference: number;
}) {
  const current = await getNewsItem(input.id);
  if (!current) {
    throw new Error("news-not-found");
  }

  const updatedAtMs = Date.now();
  return commitWrites([
    encodeWrite(
      `${securityConfig.collections.news}/${input.id}`,
      {
        title: input.title,
        body: input.body,
        preference: input.preference,
        createdAtMs: current.createdAtMs,
        updatedAtMs
      },
      true
    )
  ]);
}

export async function deleteNewsItem(id: string) {
  const current = await getNewsItem(id);
  if (!current) {
    throw new Error("news-not-found");
  }

  return commitWrites([encodeDelete(`${securityConfig.collections.news}/${id}`, true)]);
}
