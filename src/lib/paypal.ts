import { sha256 } from "./hashing";

// ── Config ───────────────────────────────────────────
function getConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const mode = process.env.PAYPAL_MODE || "sandbox";

  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
  }

  const baseUrl =
    mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  return { clientId, clientSecret, webhookId, baseUrl };
}

// ── Access Token ─────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const { clientId, clientSecret, baseUrl } = getConfig();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
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
  const { baseUrl } = getConfig();
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
  const { baseUrl } = getConfig();
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
  const { baseUrl, webhookId } = getConfig();
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
