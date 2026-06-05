import { flowConfig } from "./config";

async function sign(params: Record<string, string>): Promise<string> {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(flowConfig.secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createPaymentOrder(params: {
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
  currency?: string;
  optional?: Record<string, string>;
}): Promise<{ token: string; url: string; flowOrder: number }> {
  const body: Record<string, string> = {
    apiKey: flowConfig.apiKey,
    subject: params.subject,
    currency: params.currency ?? flowConfig.currency,
    amount: String(params.amount),
    email: params.email,
    urlConfirmation: params.urlConfirmation,
    urlReturn: params.urlReturn,
  };

  if (params.optional) {
    body.optional = JSON.stringify(params.optional);
  }

  body.s = await sign(body);

  const response = await fetch(`${flowConfig.apiUrl}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flow API error ${response.status}: ${text}`);
  }

  return response.json();
}

export async function getPaymentStatus(token: string): Promise<{
  status: number;
  amount: number;
  optional: string | null;
  flowOrder: string;
  paymentData?: {
    receipt: string;
    date: string;
    media: string;
  };
}> {
  const params: Record<string, string> = {
    apiKey: flowConfig.apiKey,
    token,
  };
  params.s = await sign(params);

  const response = await fetch(
    `${flowConfig.apiUrl}/payment/getStatus?${new URLSearchParams(params).toString()}`
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flow API error ${response.status}: ${text}`);
  }

  return response.json();
}
