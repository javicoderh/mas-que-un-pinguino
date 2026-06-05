import { securityConfig } from "./config";
import { hmacSha256Base64Url } from "./hash";

interface TokenPayload {
  issuedAtMs: number;
  nonce: string;
  intent: string;
}

const serialize = ({ issuedAtMs, nonce, intent }: TokenPayload) => `${issuedAtMs}.${nonce}.${intent}`;

export async function createFormToken(intent: string) {
  const issuedAtMs = Date.now();
  const nonce = crypto.randomUUID();
  const signature = await hmacSha256Base64Url(
    securityConfig.hashSecret,
    serialize({ issuedAtMs, nonce, intent })
  );

  return {
    issuedAtMs,
    nonce,
    signature
  };
}

export async function verifyFormToken(payload: TokenPayload, signature: string) {
  const expected = await hmacSha256Base64Url(securityConfig.hashSecret, serialize(payload));
  return expected === signature;
}
