import { isPostgresAvailable, recordPostgresReadEvent, withPostgres } from "../db/postgres";
import type { MultiModalCarouselItem } from "../../components/ui/MultiModalCarousel.astro";
import { securityConfig } from "./config";
import { commitWrites, createDocument, encodeDelete, encodeWrite, getDocument, queryCollection } from "./firestore-rest";
import { getEventSubmission } from "./events-storage";

export type CarouselItemType = "image" | "video" | "event";

export interface CarouselRecord {
  id: string;
  type: CarouselItemType;
  title: string;
  description: string;
  mediaUrl: string;
  eventId: string;
  sortOrder: number;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CarouselUpsertInput {
  type: CarouselItemType;
  title: string;
  description: string;
  mediaUrl: string;
  eventId: string;
  sortOrder: number;
  isActive: boolean;
}

function mapCarouselRow(row: Record<string, any>): CarouselRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description ?? "",
    mediaUrl: row.media_url ?? "",
    eventId: row.event_id ?? "",
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    createdAtMs: Number(row.created_at_ms ?? 0),
    updatedAtMs: Number(row.updated_at_ms ?? 0)
  };
}

function normalizeRecord(id: string, record: CarouselRecord & { id?: string }) {
  const { id: storedId, ...rest } = record;
  return { id: storedId ?? id, ...rest };
}

export function validateCarouselInput(input: CarouselUpsertInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const mediaUrl = input.mediaUrl.trim();
  const eventId = input.eventId.trim();
  const sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0;

  if (!["image", "video", "event"].includes(input.type)) {
    throw new Error("invalid_carousel_type");
  }

  if (!title) {
    throw new Error("carousel_title_required");
  }

  if ((input.type === "image" || input.type === "video") && !mediaUrl) {
    throw new Error("carousel_media_required");
  }

  if (input.type === "event" && !eventId) {
    throw new Error("carousel_event_required");
  }

  return {
    type: input.type,
    title,
    description,
    mediaUrl,
    eventId,
    sortOrder,
    isActive: input.isActive
  };
}

export async function listCarouselItems({ activeOnly = false } = {}) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent(activeOnly ? "carousel_public_list" : "carousel_admin_list");
    const rows = activeOnly
      ? await withPostgres((sql) => sql`
          select *
          from carousel_items
          where is_active = true
          order by sort_order asc, created_at_ms desc
          limit 80
        `)
      : await withPostgres((sql) => sql`
          select *
          from carousel_items
          order by sort_order asc, created_at_ms desc
          limit 120
        `);
    return rows.map(mapCarouselRow);
  }

  const rows = await queryCollection<CarouselRecord>({
    collectionId: securityConfig.collections.carousel,
    filters: activeOnly ? [{ field: "isActive", op: "EQUAL", value: true }] : [],
    limit: activeOnly ? 80 : 120
  });

  return rows.sort((a, b) => {
    const order = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
    return order !== 0 ? order : Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0);
  });
}

export async function getCarouselItem(id: string) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("carousel_item");
    const rows = await withPostgres((sql) => sql`
      select *
      from carousel_items
      where id = ${id}
      limit 1
    `);
    return rows[0] ? mapCarouselRow(rows[0]) : null;
  }

  const record = await getDocument<CarouselRecord>(`${securityConfig.collections.carousel}/${id}`);
  return record ? normalizeRecord(id, record) : null;
}

export async function createCarouselItem(rawInput: CarouselUpsertInput) {
  const input = validateCarouselInput(rawInput);
  const id = crypto.randomUUID();
  const now = Date.now();

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      insert into carousel_items (
        id, type, title, description, media_url, event_id, sort_order, is_active, created_at_ms, updated_at_ms
      ) values (
        ${id}, ${input.type}, ${input.title}, ${input.description}, ${input.mediaUrl}, ${input.eventId},
        ${input.sortOrder}, ${input.isActive}, ${now}, ${now}
      )
    `);
    return { id, ...input, createdAtMs: now, updatedAtMs: now } satisfies CarouselRecord;
  }

  await createDocument(`${securityConfig.collections.carousel}/${id}`, {
    ...input,
    createdAtMs: now,
    updatedAtMs: now
  });

  return { id, ...input, createdAtMs: now, updatedAtMs: now } satisfies CarouselRecord;
}

export async function updateCarouselItem(id: string, rawInput: CarouselUpsertInput) {
  const current = await getCarouselItem(id);
  if (!current) throw new Error("carousel-not-found");

  const input = validateCarouselInput(rawInput);
  const updatedAtMs = Date.now();

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      update carousel_items
      set type = ${input.type},
          title = ${input.title},
          description = ${input.description},
          media_url = ${input.mediaUrl},
          event_id = ${input.eventId},
          sort_order = ${input.sortOrder},
          is_active = ${input.isActive},
          updated_at_ms = ${updatedAtMs}
      where id = ${id}
    `);
    return;
  }

  return commitWrites([
    encodeWrite(
      `${securityConfig.collections.carousel}/${id}`,
      {
        ...input,
        createdAtMs: current.createdAtMs,
        updatedAtMs
      },
      true
    )
  ]);
}

export async function deleteCarouselItem(id: string) {
  const current = await getCarouselItem(id);
  if (!current) throw new Error("carousel-not-found");

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      delete from carousel_items
      where id = ${id}
    `);
    return;
  }

  return commitWrites([encodeDelete(`${securityConfig.collections.carousel}/${id}`, true)]);
}

export async function listPublicCarouselSlides(): Promise<MultiModalCarouselItem[]> {
  const items = await listCarouselItems({ activeOnly: true });
  const slides: MultiModalCarouselItem[] = [];

  for (const item of items) {
    if (item.type === "event") {
      const event = item.eventId ? await getEventSubmission(item.eventId) : null;
      if (!event || event.status !== "approved") continue;
      slides.push({
        source: event.imageUrl,
        type: "event",
        name: item.title || event.title,
        date: event.date,
        address: event.venue || event.region,
        description: item.description || event.description
      });
      continue;
    }

    slides.push({
      source: item.mediaUrl,
      type: item.type,
      name: item.title,
      description: item.description
    });
  }

  return slides;
}
