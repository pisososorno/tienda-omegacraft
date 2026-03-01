import { sha256 } from "./hashing";
import { getPaypalMode } from "./settings";

// ── Config ───────────────────────────────────────────
interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string | undefined;
  baseUrl: string;
  mode: "sandbox" | "live";
}

async function getConfig(): Promise<PayPalConfig> {
  const mode = await getPaypalMode();

  // Dual credentials: try mode-specific env vars first, fallback to legacy single vars
  const clientId =
    (mode === "live"
      ? process.env.PAYPAL_LIVE_CLIENT_ID
      : process.env.PAYPAL_SANDBOX_CLIENT_ID) ||
    process.env.PAYPAL_CLIENT_ID;

  const clientSecret =
    (mode === "live"
      ? process.env.PAYPAL_LIVE_CLIENT_SECRET
      : process.env.PAYPAL_SANDBOX_CLIENT_SECRET) ||
    process.env.PAYPAL_CLIENT_SECRET;

  const webhookId =
    (mode === "live"
      ? process.env.PAYPAL_LIVE_WEBHOOK_ID
      : process.env.PAYPAL_SANDBOX_WEBHOOK_ID) ||
    process.env.PAYPAL_WEBHOOK_ID;

  if (!clientId || !clientSecret) {
    throw new Error(
      `PayPal ${mode.toUpperCase()} credentials not configured. ` +
      `Set PAYPAL_${mode.toUpperCase()}_CLIENT_ID and PAYPAL_${mode.toUpperCase()}_CLIENT_SECRET ` +
      `(or legacy PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).`
    );
  }

  const baseUrl =
    mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  return { clientId, clientSecret, webhookId, baseUrl, mode };
}

// ── Access Token (per-mode cache) ────────────────────
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

/**
 * Invalidate cached PayPal access tokens (call when switching modes).
 */
export function invalidatePayPalTokenCache() {
  for (const key of Object.keys(tokenCache)) {
    delete tokenCache[key];
  }
}

async function getAccessToken(): Promise<string> {
  const config = await getConfig();
  const cacheKey = config.mode;

  if (tokenCache[cacheKey] && tokenCache[cacheKey].expiresAt > Date.now() + 30_000) {
    return tokenCache[cacheKey].token;
  }

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed (${config.mode}): ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  tokenCache[cacheKey] = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache[cacheKey].token;
}

// ── Create Order ─────────────────────────────────────
export interface CreatePayPalOrderInput {
  orderNumber: string;
  amountUsd: string; // e.g. "15.00"
  productName: string;
  buyerEmail: string;
}

export async function createPayPalOrder(
  input: CreatePayPalOrderInput
): Promise<{ paypalOrderId: string; approveUrl: string }> {
  const { baseUrl } = await getConfig();
  const token = await getAccessToken();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.orderNumber,
        description: input.productName.substring(0, 127),
        amount: {
          currency_code: "USD",
          value: input.amountUsd,
        },
        custom_id: input.orderNumber,
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          brand_name: process.env.APP_NAME || "TiendaDigital", // fallback; dynamic name loaded elsewhere
          locale: "en-US",
          user_action: "PAY_NOW",
          return_url: `${process.env.APP_URL}/checkout/return`,
          cancel_url: `${process.env.APP_URL}/checkout/cancel`,
        },
      },
    },
  };

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": input.orderNumber, // Idempotency key
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${error}`);
  }

  const data = await res.json();
  const approveLink = data.links?.find(
    (l: { rel: string }) => l.rel === "payer-action"
  );

  return {
    paypalOrderId: data.id,
    approveUrl: approveLink?.href || "",
  };
}

// ── Capture Order ────────────────────────────────────
export interface CaptureResult {
  captureId: string;
  status: string;
  payerName: string;
  payerEmail: string;
  payerId: string;
  rawCapture: Record<string, unknown>;
}

export async function capturePayPalOrder(
  paypalOrderId: string
): Promise<CaptureResult> {
  const { baseUrl } = await getConfig();
  const token = await getAccessToken();

  const res = await fetch(
    `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${error}`);
  }

  const data = await res.json();
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

  const givenName = data.payer?.name?.given_name || "";
  const surname = data.payer?.name?.surname || "";
  const payerName = [givenName, surname].filter(Boolean).join(" ");

  return {
    captureId: capture?.id || "",
    status: data.status,
    payerName,
    payerEmail: data.payer?.email_address || "",
    payerId: data.payer?.payer_id || "",
    rawCapture: data,
  };
}

// ── Verify Webhook Signature ─────────────────────────
export async function verifyWebhookSignature(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const { baseUrl, webhookId } = await getConfig();
  if (!webhookId) return false;

  const token = await getAccessToken();

  const verifyBody = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: JSON.parse(body),
  };

  const res = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verifyBody),
    }
  );

  if (!res.ok) return false;

  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

// ── Extract PayPal Event ID from webhook payload ─────
export function extractPayPalEventId(
  payload: Record<string, unknown>
): string {
  return (payload.id as string) || "";
}

// ── Compute webhook payload hash for external_ref ────
export function computeWebhookRef(eventId: string): string {
  return `paypal:${eventId}`;
}
