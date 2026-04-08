import { securityConfig } from "./config";

type Primitive = string | number | boolean | null;
type FirestoreData = Primitive | FirestoreData[] | { [key: string]: FirestoreData };
type FirestoreFilter = { field: string; op: string; value: FirestoreData };

interface FirestoreWrite {
  update?: {
    name: string;
    fields: Record<string, unknown>;
  };
  delete?: string;
  transform?: {
    document: string;
    fieldTransforms: Array<Record<string, unknown>>;
  };
  currentDocument?: {
    exists?: boolean;
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

const firestoreBaseUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${securityConfig.firestore.projectId}/databases/(default)`;
const firestoreDocumentRoot = () =>
  `projects/${securityConfig.firestore.projectId}/databases/(default)/documents`;

const oauthAudience = "https://oauth2.googleapis.com/token";
const firestoreScope = "https://www.googleapis.com/auth/datastore";

const toBase64Url = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const encodeFirestoreValue = (value: FirestoreData): Record<string, unknown> => {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeFirestoreValue(item))
      }
    };
  }

  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, encodeFirestoreValue(item)])
      )
    }
  };
};

const decodeFirestoreValue = (value: any): any => {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeFirestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decodeFirestoreValue(item)])
    );
  }
  return undefined;
};

const encodeDocumentFields = (data: Record<string, FirestoreData>) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeFirestoreValue(value)]));

const buildWhereClause = (filters: FirestoreFilter[]) =>
  filters.length === 0
    ? undefined
    : filters.length === 1
      ? {
          fieldFilter: {
            field: { fieldPath: filters[0].field },
            op: filters[0].op,
            value: encodeFirestoreValue(filters[0].value)
          }
        }
      : {
          compositeFilter: {
            op: "AND",
            filters: filters.map((filter) => ({
              fieldFilter: {
                field: { fieldPath: filter.field },
                op: filter.op,
                value: encodeFirestoreValue(filter.value)
              }
            }))
          }
        };

const buildJwt = async () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: securityConfig.firestore.clientEmail,
      scope: firestoreScope,
      aud: oauthAudience,
      exp: nowSeconds + 3600,
      iat: nowSeconds
    })
  );
  const unsigned = `${header}.${claimSet}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(securityConfig.firestore.privateKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64"),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
};

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const assertion = await buildJwt();
  const response = await fetch(oauthAudience, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    throw new Error(`oauth-token-failed:${response.status}`);
  }

  const payload = await response.json();
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000
  };

  return cachedToken.value;
}

async function firestoreFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${firestoreBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });

  return response;
}

async function parseStreamingJson<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? (parsed as T[]) : [parsed as T];
  } catch {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }
}

export const documentPath = (relativePath: string) =>
  `${firestoreDocumentRoot()}/${relativePath}`;

export async function getDocument<T = Record<string, unknown>>(relativePath: string): Promise<T | null> {
  const response = await firestoreFetch(`/documents/${relativePath}`, { method: "GET" });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`firestore-get-failed:${response.status}`);

  const payload = await response.json();
  return Object.fromEntries(
    Object.entries(payload.fields ?? {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
  ) as T;
}

export async function commitWrites(writes: FirestoreWrite[]) {
  const response = await firestoreFetch("/documents:commit", {
    method: "POST",
    body: JSON.stringify({
      writes
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`firestore-commit-failed:${response.status}:${errorText}`);
  }

  return response.json();
}

export async function createDocument(relativePath: string, data: Record<string, FirestoreData>) {
  return commitWrites([
    {
      update: {
        name: documentPath(relativePath),
        fields: encodeDocumentFields(data)
      },
      currentDocument: {
        exists: false
      }
    }
  ]);
}

export async function countNestedDocuments(parentPath: string, collectionId: string, minSubmittedAtMs: number) {
  const response = await firestoreFetch(
    `/documents/${parentPath}:runAggregationQuery`,
    {
      method: "POST",
      body: JSON.stringify({
        structuredAggregationQuery: {
          aggregations: [{ alias: "total", count: {} }],
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: "submittedAtMs" },
                op: "GREATER_THAN_OR_EQUAL",
                value: { integerValue: String(minSubmittedAtMs) }
              }
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`firestore-count-failed:${response.status}`);
  }

  const rows = await parseStreamingJson<any>(response);
  return Number(rows?.[0]?.result?.aggregateFields?.total?.integerValue ?? 0);
}

export async function countCollectionDocuments(
  collectionId: string,
  filters: FirestoreFilter[]
) {
  const where = buildWhereClause(filters);

  const response = await firestoreFetch("/documents:runAggregationQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredAggregationQuery: {
        aggregations: [{ alias: "total", count: {} }],
        structuredQuery: {
          from: [{ collectionId }],
          ...(where ? { where } : {})
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`firestore-root-count-failed:${response.status}`);
  }

  const rows = await parseStreamingJson<any>(response);
  return Number(rows?.[0]?.result?.aggregateFields?.total?.integerValue ?? 0);
}

export function encodeWrite(relativePath: string, data: Record<string, FirestoreData>, exists?: boolean): FirestoreWrite {
  return {
    update: {
      name: documentPath(relativePath),
      fields: encodeDocumentFields(data)
    },
    currentDocument: exists === undefined ? undefined : { exists }
  };
}

export function encodeIncrementTransform(relativePath: string, fieldPath: string): FirestoreWrite {
  return encodeIncrementTransforms(relativePath, [fieldPath]);
}

export function encodeIncrementTransforms(relativePath: string, fieldPaths: string[]): FirestoreWrite {
  return {
    transform: {
      document: documentPath(relativePath),
      fieldTransforms: [
        ...fieldPaths.map((fieldPath) => ({
          fieldPath,
          increment: { integerValue: "1" }
        })),
        {
          fieldPath: "updatedAtMs",
          setToServerValue: "REQUEST_TIME"
        }
      ]
    }
  };
}

export function encodeDelete(relativePath: string, exists?: boolean): FirestoreWrite {
  return {
    delete: documentPath(relativePath),
    currentDocument: exists === undefined ? undefined : { exists }
  };
}

export async function queryCollection<T = Record<string, unknown>>(options: {
  collectionId: string;
  filters?: FirestoreFilter[];
  orderBy?: Array<{ field: string; direction?: "ASCENDING" | "DESCENDING" }>;
  limit?: number;
  offset?: number;
}) {
  const { collectionId, filters = [], orderBy = [], limit, offset } = options;
  const where = buildWhereClause(filters);
  const response = await firestoreFetch("/documents:runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        ...(where ? { where } : {}),
        ...(orderBy.length > 0
          ? {
              orderBy: orderBy.map((item) => ({
                field: { fieldPath: item.field },
                direction: item.direction ?? "ASCENDING"
              }))
            }
          : {}),
        ...(typeof limit === "number" ? { limit } : {}),
        ...(typeof offset === "number" && offset > 0 ? { offset } : {})
      }
    })
  });

  if (!response.ok) {
    throw new Error(`firestore-query-failed:${response.status}`);
  }

  const rows = await parseStreamingJson<any>(response);
  return rows
    .filter((row) => row.document?.fields)
    .map((row) => {
      const documentName = String(row.document.name ?? "");
      const id = documentName.split("/").pop() ?? "";
      return {
        id,
        ...Object.fromEntries(
          Object.entries(row.document.fields ?? {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
        )
      } as T & { id: string };
    });
}
