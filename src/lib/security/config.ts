const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseCsv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const withAttackMode = (normal: number, attack: number, attackMode: boolean) =>
  attackMode ? attack : normal;

export interface RateLimitRule {
  name: string;
  windowMs: number;
  maxHits: number;
}

const highProtectionMode = parseBoolean(import.meta.env.SECURITY_HIGH_PROTECTION_MODE);

export const securityConfig = {
  highProtectionMode,
  hashSecret: import.meta.env.SECURITY_HASH_SECRET ?? "",
  maxPayloadBytes: parseNumber(import.meta.env.SECURITY_MAX_PAYLOAD_BYTES, 16_384),
  minSubmitTimeMs: withAttackMode(
    parseNumber(import.meta.env.SECURITY_MIN_SUBMIT_TIME_MS, 2_500),
    parseNumber(import.meta.env.SECURITY_ATTACK_MIN_SUBMIT_TIME_MS, 4_500),
    highProtectionMode
  ),
  maxTokenAgeMs: parseNumber(import.meta.env.SECURITY_MAX_FORM_TOKEN_AGE_MS, 1000 * 60 * 90),
  ipCooldownMs: parseNumber(import.meta.env.SECURITY_DUPLICATE_IP_COOLDOWN_MS, 1000 * 60 * 10),
  allowedOrigins:
    parseCsv(import.meta.env.SECURITY_ALLOWED_ORIGINS).length > 0
      ? parseCsv(import.meta.env.SECURITY_ALLOWED_ORIGINS)
      : [
          "https://esmasqueunpinguino.cl",
          "https://www.esmasqueunpinguino.cl",
          "https://masqueunpinguino.cl",
          "https://www.masqueunpinguino.cl",
          "http://localhost:4321",
          "http://127.0.0.1:4321"
        ],
  captcha: {
    enabled: highProtectionMode
      ? parseBoolean(import.meta.env.SECURITY_ATTACK_CAPTCHA_ENABLED, true)
      : parseBoolean(import.meta.env.SECURITY_CAPTCHA_ENABLED, false),
    provider: import.meta.env.SECURITY_CAPTCHA_PROVIDER ?? "turnstile",
    siteKey:
      import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ??
      import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY ??
      "",
    secret:
      import.meta.env.TURNSTILE_SECRET_KEY ??
      import.meta.env.RECAPTCHA_SECRET_KEY ??
      ""
  },
  firestore: {
    projectId:
      import.meta.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID ??
      import.meta.env.GOOGLE_CLOUD_PROJECT ??
      import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ??
      "",
    clientEmail: import.meta.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL ?? "",
    privateKey: (import.meta.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n")
  },
  collections: {
    signatures: import.meta.env.FIREBASE_SIGNATURES_COLLECTION ?? "campaign_signatures",
    dedupeEmails: import.meta.env.FIREBASE_SIGNATURES_DEDUPE_EMAIL_COLLECTION ?? "signature_dedupe_email",
    dedupeIdentity:
      import.meta.env.FIREBASE_SIGNATURES_DEDUPE_IDENTITY_COLLECTION ?? "signature_dedupe_identity",
    dedupeRut: import.meta.env.FIREBASE_SIGNATURES_DEDUPE_RUT_COLLECTION ?? "signature_dedupe_rut",
    eventSubmissions:
      import.meta.env.FIREBASE_EVENT_SUBMISSIONS_COLLECTION ?? "event_submissions",
    eventDedupe:
      import.meta.env.FIREBASE_EVENT_DEDUPE_COLLECTION ?? "event_submission_dedupe",
    news:
      import.meta.env.FIREBASE_NEWS_COLLECTION ?? "campaign_news",
    adminUsers:
      import.meta.env.FIREBASE_ADMIN_USERS_COLLECTION ?? "admin_users",
    rateLimitRoot: import.meta.env.FIREBASE_RATE_LIMIT_ROOT_COLLECTION ?? "security_rate_limits",
    events: import.meta.env.FIREBASE_SECURITY_EVENTS_COLLECTION ?? "security_events",
    usedTokens: import.meta.env.FIREBASE_USED_TOKENS_COLLECTION ?? "security_used_tokens",
    counterCollection:
      import.meta.env.PUBLIC_FIREBASE_COUNTER_COLLECTION ?? "public_stats",
    counterDoc: import.meta.env.PUBLIC_FIREBASE_COUNTER_DOC ?? "signatures_counter"
  },
  rateLimits: {
    formGet: [
      {
        name: "burst",
        windowMs: 1000 * 60,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_FORM_GET_BURST_LIMIT, 45),
          parseNumber(import.meta.env.SECURITY_ATTACK_FORM_GET_BURST_LIMIT, 20),
          highProtectionMode
        )
      },
      {
        name: "window",
        windowMs: 1000 * 60 * 15,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_FORM_GET_WINDOW_LIMIT, 180),
          parseNumber(import.meta.env.SECURITY_ATTACK_FORM_GET_WINDOW_LIMIT, 75),
          highProtectionMode
        )
      }
    ] satisfies RateLimitRule[],
    signaturePostIp: [
      {
        name: "burst",
        windowMs: 1000 * 60,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_SIGNATURE_POST_IP_BURST_LIMIT, 5),
          parseNumber(import.meta.env.SECURITY_ATTACK_SIGNATURE_POST_IP_BURST_LIMIT, 3),
          highProtectionMode
        )
      },
      {
        name: "window",
        windowMs: 1000 * 60 * 60,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_SIGNATURE_POST_IP_WINDOW_LIMIT, 12),
          parseNumber(import.meta.env.SECURITY_ATTACK_SIGNATURE_POST_IP_WINDOW_LIMIT, 6),
          highProtectionMode
        )
      }
    ] satisfies RateLimitRule[],
    signaturePostFingerprint: [
      {
        name: "burst",
        windowMs: 1000 * 60 * 10,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_SIGNATURE_POST_FP_BURST_LIMIT, 3),
          parseNumber(import.meta.env.SECURITY_ATTACK_SIGNATURE_POST_FP_BURST_LIMIT, 2),
          highProtectionMode
        )
      },
      {
        name: "window",
        windowMs: 1000 * 60 * 60 * 6,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_SIGNATURE_POST_FP_WINDOW_LIMIT, 4),
          parseNumber(import.meta.env.SECURITY_ATTACK_SIGNATURE_POST_FP_WINDOW_LIMIT, 2),
          highProtectionMode
        )
      }
    ] satisfies RateLimitRule[],
    eventPostIp: [
      {
        name: "burst",
        windowMs: 1000 * 60 * 5,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_EVENT_POST_IP_BURST_LIMIT, 4),
          parseNumber(import.meta.env.SECURITY_ATTACK_EVENT_POST_IP_BURST_LIMIT, 2),
          highProtectionMode
        )
      },
      {
        name: "window",
        windowMs: 1000 * 60 * 60 * 3,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_EVENT_POST_IP_WINDOW_LIMIT, 8),
          parseNumber(import.meta.env.SECURITY_ATTACK_EVENT_POST_IP_WINDOW_LIMIT, 4),
          highProtectionMode
        )
      }
    ] satisfies RateLimitRule[],
    adminLoginIp: [
      {
        name: "burst",
        windowMs: 1000 * 60 * 15,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_ADMIN_LOGIN_IP_BURST_LIMIT, 6),
          parseNumber(import.meta.env.SECURITY_ATTACK_ADMIN_LOGIN_IP_BURST_LIMIT, 3),
          highProtectionMode
        )
      },
      {
        name: "window",
        windowMs: 1000 * 60 * 60 * 4,
        maxHits: withAttackMode(
          parseNumber(import.meta.env.SECURITY_ADMIN_LOGIN_IP_WINDOW_LIMIT, 18),
          parseNumber(import.meta.env.SECURITY_ATTACK_ADMIN_LOGIN_IP_WINDOW_LIMIT, 8),
          highProtectionMode
        )
      }
    ] satisfies RateLimitRule[]
  }
};

export const alertWebhookUrl: string = import.meta.env.SECURITY_ALERT_WEBHOOK_URL ?? "";

export const isSecurityConfigured = Boolean(securityConfig.hashSecret);
export const isServerStorageConfigured = Boolean(
  securityConfig.firestore.projectId &&
    securityConfig.firestore.clientEmail &&
    securityConfig.firestore.privateKey
);
export const isPublicFirestoreConfigured = Boolean(
  import.meta.env.PUBLIC_FIREBASE_PROJECT_ID && import.meta.env.PUBLIC_FIREBASE_API_KEY
);
export const isAdminBootstrapConfigured = Boolean(
  import.meta.env.ADMIN_USERNAME && import.meta.env.ADMIN_PASSWORD
);
