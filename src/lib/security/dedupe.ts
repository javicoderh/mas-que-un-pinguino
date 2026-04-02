import { securityConfig } from "./config";
import { hashWithSecret } from "./hash";

export interface SignatureDedupeKeys {
  emailHash: string;
  identityHash: string;
  rutHash: string;
  ipEmailHash: string;
}

export async function buildSignatureDedupeKeys(input: {
  normalizedEmail: string;
  normalizedIdentity: string;
  normalizedRut: string;
  ipHash: string;
}) {
  return {
    emailHash: await hashWithSecret(securityConfig.hashSecret, "email", input.normalizedEmail),
    identityHash: await hashWithSecret(securityConfig.hashSecret, "identity", input.normalizedIdentity),
    rutHash: await hashWithSecret(securityConfig.hashSecret, "rut", input.normalizedRut),
    ipEmailHash: await hashWithSecret(
      securityConfig.hashSecret,
      "ip_email",
      input.ipHash,
      input.normalizedEmail
    )
  } satisfies SignatureDedupeKeys;
}
