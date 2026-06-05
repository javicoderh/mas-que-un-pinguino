const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export interface PasswordHashRecord {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPassword(password: string, iterations = 160_000): Promise<PasswordHashRecord> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations
    },
    keyMaterial,
    256
  );

  return {
    salt: toBase64Url(saltBytes),
    hash: toBase64Url(new Uint8Array(derived)),
    iterations
  };
}

export async function verifyPassword(password: string, record: PasswordHashRecord) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64Url(record.salt),
      iterations: record.iterations
    },
    keyMaterial,
    256
  );

  return toBase64Url(new Uint8Array(derived)) === record.hash;
}
