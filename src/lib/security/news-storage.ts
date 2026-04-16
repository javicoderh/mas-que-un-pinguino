import { recordPostgresReadEvent, withPostgres, isPostgresAvailable } from "../db/postgres";
import { securityConfig } from "./config";
import { commitWrites, createDocument, encodeDelete, encodeWrite, getDocument, queryCollection } from "./firestore-rest";

export interface NewsRecord {
  id: string;
  title: string;
  body: string;
  link: string;
  imageUrl: string;
  preference: number;
  createdAtMs: number;
  updatedAtMs: number;
}

function mapNewsRow(row: Record<string, any>): NewsRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link ?? "",
    imageUrl: row.image_url ?? "",
    preference: Number(row.preference ?? 0),
    createdAtMs: Number(row.created_at_ms ?? 0),
    updatedAtMs: Number(row.updated_at_ms ?? 0)
  };
}

export async function listNews() {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("news_list");
    const rows = await withPostgres((sql) => sql`
      select *
      from news_items
      order by created_at_ms desc
      limit 200
    `);
    return rows.map(mapNewsRow);
  }

  const rows = await queryCollection<NewsRecord>({
    collectionId: securityConfig.collections.news,
    limit: 200
  });

  return rows.sort((a, b) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0));
}

export async function getNewsItem(id: string) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("news_item");
    const rows = await withPostgres((sql) => sql`
      select *
      from news_items
      where id = ${id}
      limit 1
    `);
    return rows[0] ? mapNewsRow(rows[0]) : null;
  }

  const record = await getDocument<NewsRecord>(`${securityConfig.collections.news}/${id}`);
  if (!record) return null;
  const { id: storedId, ...rest } = record as NewsRecord & { id?: string };
  return { id: storedId ?? id, ...rest };
}

export async function createNewsItem(input: { title: string; body: string; link: string; imageUrl: string }) {
  const id = crypto.randomUUID();
  const now = Date.now();

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      insert into news_items (id, title, body, link, image_url, preference, created_at_ms, updated_at_ms)
      values (${id}, ${input.title}, ${input.body}, ${input.link}, ${input.imageUrl}, 0, ${now}, ${now})
    `);
    return { id, title: input.title, body: input.body, link: input.link, imageUrl: input.imageUrl, preference: 0, createdAtMs: now, updatedAtMs: now };
  }

  await createDocument(`${securityConfig.collections.news}/${id}`, {
    title: input.title,
    body: input.body,
    link: input.link,
    imageUrl: input.imageUrl,
    preference: 0,
    createdAtMs: now,
    updatedAtMs: now
  });

  return { id, title: input.title, body: input.body, link: input.link, imageUrl: input.imageUrl, preference: 0, createdAtMs: now, updatedAtMs: now };
}

export async function updateNewsItem(input: {
  id: string;
  title: string;
  body: string;
  link: string;
  imageUrl: string;
  preference: number;
}) {
  const current = await getNewsItem(input.id);
  if (!current) {
    throw new Error("news-not-found");
  }

  const updatedAtMs = Date.now();

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      update news_items
      set title = ${input.title},
          body = ${input.body},
          link = ${input.link},
          image_url = ${input.imageUrl},
          preference = ${input.preference},
          updated_at_ms = ${updatedAtMs}
      where id = ${input.id}
    `);
    return;
  }

  return commitWrites([
    encodeWrite(
      `${securityConfig.collections.news}/${input.id}`,
      {
        title: input.title,
        body: input.body,
        link: input.link,
        imageUrl: input.imageUrl,
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

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      delete from news_items
      where id = ${id}
    `);
    return;
  }

  return commitWrites([encodeDelete(`${securityConfig.collections.news}/${id}`, true)]);
}
