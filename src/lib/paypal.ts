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

// ── Check if PayPal API is configured ─────────────────
export async function isPayPalConfigured(): Promise<boolean> {
  try {
    await getConfig();
    return true;
  } catch {
    return false;
  }
}

// ── Invoice Status Check (Invoicing API v2) ──────────
export interface InvoiceStatusResult {
  invoiceId: string;
  invoiceNumber: string | null;
  status: string; // PAID, SENT, DRAFT, CANCELLED, etc.
  paid: boolean;
  // Amounts
  amountDue: string | null;
  amountPaid: string | null;
  currency: string | null;
  // Breakdown
  subtotal: string | null;
  tax: string | null;
  discount: string | null;
  shipping: string | null;
  // Payer info (from billing_info or transaction)
  payerEmail: string | null;
  payerName: string | null;
  // Transaction details
  transactionId: string | null;
  paymentDate: string | null;
  paymentMethod: string | null; // PAYPAL, BANK_TRANSFER, etc.
  // Raw response for audit
  raw: Record<string, unknown>;
}

/**
 * Extract a PayPal invoice ID from a URL like:
 * https://www.sandbox.paypal.com/invoice/p/#INV2-VL2V-WSYW-XD6F-S5TC
 * https://www.paypal.com/invoice/p/#INV2-VL2V-WSYW-XD6F-S5TC
 * Or a direct invoice ID like INV2-VL2V-WSYW-XD6F-S5TC
 */
export function extractInvoiceId(paymentRef: string): string | null {
  if (!paymentRef) return null;
  // Direct invoice ID
  if (/^INV2?-/i.test(paymentRef.trim())) return paymentRef.trim();
  // Extract from URL (after # or last path segment)
  const hashMatch = paymentRef.match(/#(INV2?-[A-Z0-9-]+)/i);
  if (hashMatch) return hashMatch[1];
  const pathMatch = paymentRef.match(/\/(INV2?-[A-Z0-9-]+)/i);
  if (pathMatch) return pathMatch[1];
  return null;
}

/**
 * Query PayPal Invoicing API to get full invoice details.
 * Extracts payer info, transaction ID, amount breakdown, and raw response.
 * Returns null if invoice not found or API error.
 */
export async function getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult | null> {
  try {
    const { baseUrl } = await getConfig();
    const token = await getAccessToken();

    const res = await fetch(`${baseUrl}/v2/invoicing/invoices/${invoiceId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[paypal] Invoice status check failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const status = data.status || "UNKNOWN";
    const paid = status === "PAID" || status === "MARKED_AS_PAID";

    // Extract payer info from billing_info
    const billingInfo = data.detail?.billing_info?.[0];
    const payerEmail = billingInfo?.email_address || null;
    const givenName = billingInfo?.name?.given_name || "";
    const surname = billingInfo?.name?.surname || "";
    const payerName = [givenName, surname].filter(Boolean).join(" ") || null;

    // Extract transaction details from payments
    const firstTxn = data.payments?.transactions?.[0];
    const transactionId = firstTxn?.payment_id || null;
    const paymentDate = firstTxn?.payment_date || null;
    const paymentMethod = firstTxn?.method || null;

    // Amount breakdown
    const breakdown = data.amount?.breakdown;

    return {
      invoiceId,
      invoiceNumber: data.detail?.invoice_number || null,
      status,
      paid,
      amountDue: data.amount?.value || null,
      amountPaid: data.payments?.paid_amount?.value || firstTxn?.amount?.value || null,
      currency: data.amount?.currency_code || null,
      subtotal: breakdown?.item_total?.value || null,
      tax: breakdown?.tax_total?.value || null,
      discount: breakdown?.discount?.invoice_discount?.value || breakdown?.discount?.value || null,
      shipping: breakdown?.shipping?.amount?.value || breakdown?.shipping?.value || null,
      payerEmail,
      payerName,
      transactionId,
      paymentDate,
      paymentMethod,
      raw: data,
    };
  } catch (err) {
    console.error("[paypal] getInvoiceStatus error:", err);
    return null;
  }
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
