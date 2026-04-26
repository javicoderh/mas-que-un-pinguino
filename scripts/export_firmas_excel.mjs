/**
 * Extrae todas las firmas de PostgreSQL (Neon) y Firebase Firestore
 * y las exporta a un archivo Excel con todas las columnas disponibles.
 *
 * Uso: node scripts/export_firmas_excel.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Cargar variables de entorno desde .env ─────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  const raw = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, "\n");
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();

// ─── PostgreSQL ──────────────────────────────────────────────────────────────
async function fetchPostgresSignatures() {
  const { default: postgres } = await import("postgres");

  const sql = postgres(env.DATABASE_URL_UNPOOLED, {
    prepare: false,
    ssl: "require",
    connect_timeout: 15
  });

  console.log("Conectando a PostgreSQL...");

  const [mainRows, foreignRows] = await Promise.all([
    sql`
      SELECT
        id,
        first_name        AS "Nombre",
        last_name         AS "Apellido",
        full_name         AS "Nombre completo",
        rut               AS "RUT",
        email             AS "Email",
        age               AS "Edad",
        country           AS "País",
        legal_nature      AS "Naturaleza legal",
        region            AS "Región",
        commune           AS "Comuna",
        affiliation       AS "Afiliación",
        message           AS "Mensaje",
        consent           AS "Consentimiento",
        updates           AS "Acepta actualizaciones",
        status            AS "Estado",
        abuse_reason      AS "Razón abuso",
        risk_decision     AS "Decisión riesgo",
        risk_score        AS "Puntaje riesgo",
        risk_reasons      AS "Razones riesgo",
        source_origin_host AS "Origen (host)",
        source_name       AS "Fuente",
        to_timestamp(source_submitted_at_ms / 1000.0) AS "Fecha envío",
        to_timestamp(created_at_ms / 1000.0)          AS "Fecha creación"
      FROM signatures
      ORDER BY created_at_ms DESC
    `,
    sql`
      SELECT
        id,
        name              AS "Nombre completo",
        country           AS "País",
        reason            AS "Razón",
        email             AS "Email",
        status            AS "Estado",
        to_timestamp(created_at_ms / 1000.0) AS "Fecha creación"
      FROM foreign_signatures
      ORDER BY created_at_ms DESC
    `
  ]);

  await sql.end();

  console.log(`  → ${mainRows.length} firmas en tabla 'signatures'`);
  console.log(`  → ${foreignRows.length} firmas en tabla 'foreign_signatures'`);

  return { mainRows, foreignRows };
}

// ─── Firebase Firestore (REST API) ──────────────────────────────────────────
async function getFirestoreAccessToken() {
  // JWT manual para service account
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      sub: env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/datastore"
    })
  ).toString("base64url");

  const { createSign } = await import("crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore auth failed: ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

function parseFirestoreValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) {
    const fields = v.mapValue.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, val]) => [k, parseFirestoreValue(val)]));
  }
  if ("arrayValue" in v) {
    return (v.arrayValue.values ?? []).map(parseFirestoreValue);
  }
  if ("nullValue" in v) return null;
  return JSON.stringify(v);
}

async function fetchFirestoreSignatures() {
  const projectId = env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID || env.PUBLIC_FIREBASE_PROJECT_ID;
  const collection = env.PUBLIC_FIREBASE_SIGNATURES_COLLECTION || "campaign_signatures";

  console.log("Obteniendo token de Firebase...");
  const token = await getFirestoreAccessToken();

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;
  const allDocs = [];
  let pageToken = null;
  let page = 1;

  console.log(`Descargando colección '${collection}' de Firestore...`);

  do {
    const url = new URL(baseUrl);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore query failed: ${text}`);
    }

    const data = await res.json();
    const docs = data.documents ?? [];
    allDocs.push(...docs);
    pageToken = data.nextPageToken ?? null;
    process.stdout.write(`\r  → Página ${page}: ${allDocs.length} documentos descargados...`);
    page++;
  } while (pageToken);

  console.log(`\n  → Total: ${allDocs.length} documentos en Firestore`);

  return allDocs.map((doc) => {
    const fields = doc.fields ?? {};
    const parsed = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, parseFirestoreValue(v)])
    );

    const source = parsed.source ?? {};
    const security = parsed.security ?? {};
    const dedupe = parsed.dedupe ?? {};

    return {
      id: doc.name?.split("/").pop() ?? "",
      "Nombre": parsed.firstName ?? "",
      "Apellido": parsed.lastName ?? "",
      "Nombre completo": parsed.fullName ?? "",
      "RUT": parsed.rut ?? "",
      "Email": parsed.email ?? "",
      "Edad": parsed.age ?? "",
      "País": parsed.country ?? "",
      "Naturaleza legal": parsed.legalNature ?? "",
      "Región": parsed.region ?? "",
      "Comuna": parsed.commune ?? "",
      "Afiliación": parsed.affiliation ?? "",
      "Mensaje": parsed.message ?? "",
      "Consentimiento": parsed.consent ?? "",
      "Acepta actualizaciones": parsed.updates ?? "",
      "Estado": parsed.status ?? "",
      "Razón abuso": parsed.abuseReason ?? "",
      "Decisión riesgo": parsed.riskDecision ?? "",
      "Puntaje riesgo": parsed.riskScore ?? "",
      "Razones riesgo": Array.isArray(parsed.riskReasons) ? parsed.riskReasons.join(", ") : "",
      "Origen (host)": source.originHost ?? "",
      "Fuente": parsed.sourceName ?? "",
      "Fecha envío": source.submittedAtMs
        ? new Date(Number(source.submittedAtMs)).toISOString()
        : "",
      "Fecha creación": parsed.createdAtMs
        ? new Date(Number(parsed.createdAtMs)).toISOString()
        : ""
    };
  });
}

// ─── Formatear filas de Postgres ─────────────────────────────────────────────
function formatPgRow(row) {
  const out = { ...row };
  // Convertir timestamps a ISO string
  for (const key of ["Fecha envío", "Fecha creación"]) {
    if (out[key] instanceof Date) {
      out[key] = out[key].toISOString();
    }
  }
  // Convertir jsonb arrays a string
  if (out["Razones riesgo"] && typeof out["Razones riesgo"] === "object") {
    out["Razones riesgo"] = Array.isArray(out["Razones riesgo"])
      ? out["Razones riesgo"].join(", ")
      : JSON.stringify(out["Razones riesgo"]);
  }
  if (typeof out["Consentimiento"] === "boolean") out["Consentimiento"] = out["Consentimiento"] ? "Sí" : "No";
  if (typeof out["Acepta actualizaciones"] === "boolean")
    out["Acepta actualizaciones"] = out["Acepta actualizaciones"] ? "Sí" : "No";
  return out;
}

// ─── Construir y guardar Excel ────────────────────────────────────────────────
async function buildExcel({ mainRows, foreignRows, firestoreRows }) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Firmas principales (PostgreSQL)
  const pgMain = mainRows.map(formatPgRow);
  if (pgMain.length > 0) {
    const ws1 = XLSX.utils.json_to_sheet(pgMain);
    XLSX.utils.book_append_sheet(wb, ws1, "Firmas (PostgreSQL)");
  } else {
    const ws1 = XLSX.utils.aoa_to_sheet([["Sin datos"]]);
    XLSX.utils.book_append_sheet(wb, ws1, "Firmas (PostgreSQL)");
  }

  // Hoja 2: Firmas extranjeras (PostgreSQL)
  const pgForeign = foreignRows.map((r) => {
    const out = { ...r };
    if (out["Fecha creación"] instanceof Date) out["Fecha creación"] = out["Fecha creación"].toISOString();
    return out;
  });
  if (pgForeign.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(pgForeign);
    XLSX.utils.book_append_sheet(wb, ws2, "Firmas extranjeras (PG)");
  } else {
    const ws2 = XLSX.utils.aoa_to_sheet([["Sin datos"]]);
    XLSX.utils.book_append_sheet(wb, ws2, "Firmas extranjeras (PG)");
  }

  // Hoja 3: Firestore histórico
  if (firestoreRows.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(firestoreRows);
    XLSX.utils.book_append_sheet(wb, ws3, "Firmas históricas (Firestore)");
  } else {
    const ws3 = XLSX.utils.aoa_to_sheet([["Sin datos"]]);
    XLSX.utils.book_append_sheet(wb, ws3, "Firmas históricas (Firestore)");
  }

  const outPath = resolve(__dirname, `../firmas-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  XLSX.writeFile(wb, outPath);
  return outPath;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Exportación de firmas a Excel ===\n");

  let mainRows = [], foreignRows = [], firestoreRows = [];

  // PostgreSQL
  try {
    ({ mainRows, foreignRows } = await fetchPostgresSignatures());
  } catch (err) {
    console.error("Error al leer PostgreSQL:", err.message);
  }

  // Firestore
  try {
    firestoreRows = await fetchFirestoreSignatures();
  } catch (err) {
    console.error("Error al leer Firestore:", err.message);
    console.error("  (Si la colección está vacía o no hay permisos, se omite)");
  }

  const total = mainRows.length + foreignRows.length + firestoreRows.length;
  console.log(`\nTotal de firmas a exportar: ${total}`);

  if (total === 0) {
    console.error("No se encontraron firmas. Verifica la conexión y las credenciales.");
    process.exit(1);
  }

  console.log("\nGenerando archivo Excel...");
  const outPath = await buildExcel({ mainRows, foreignRows, firestoreRows });

  console.log(`\n✓ Archivo generado: ${outPath}`);
  console.log(`  - Hoja "Firmas (PostgreSQL)":         ${mainRows.length} filas`);
  console.log(`  - Hoja "Firmas extranjeras (PG)":     ${foreignRows.length} filas`);
  console.log(`  - Hoja "Firmas históricas (Firestore)": ${firestoreRows.length} filas`);
}

main().catch((err) => {
  console.error("\nError fatal:", err);
  process.exit(1);
});
