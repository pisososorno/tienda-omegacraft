import { randomBytes } from "crypto";
import { hmacSign, hmacVerify, sha256 } from "./hashing";

const DOWNLOAD_SECRET = () => {
  const s = process.env.DOWNLOAD_SECRET;
  if (!s) throw new Error("DOWNLOAD_SECRET not set");
  return s;
};

export interface DownloadTokenPayload {
  orderId: string;
  stageId?: string;
  exp: number; // unix timestamp
}

/**
 * Generate a download token: raw token (for URL) + hash (for DB).
 * Token format: base64url(JSON payload) + "." + HMAC signature
 * DB stores only SHA256(raw_token).
 */
export function generateDownloadToken(
  orderId: string,
  stageId?: string,
  expiresInMinutes: number = 15
): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
  const payload: DownloadTokenPayload = { orderId, exp };
  if (stageId) payload.stageId = stageId;

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const nonce = randomBytes(8).toString("hex");
  const dataToSign = `${payloadB64}.${nonce}`;
  const signature = hmacSign(dataToSign, DOWNLOAD_SECRET());
  const rawToken = `${dataToSign}.${signature}`;
  const tokenHash = sha256(rawToken);

  return {
    rawToken,
    tokenHash,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Verify and decode a download token.
 * Returns payload if valid, null if invalid/expired.
 */
export function verifyDownloadToken(
  rawToken: string
): DownloadTokenPayload | null {
  try {
    const parts = rawToken.split(".");
    if (parts.length !== 3) return null;

    const [payloadB64, nonce, signature] = parts;
    const dataToVerify = `${payloadB64}.${nonce}`;

    if (!hmacVerify(dataToVerify, signature, DOWNLOAD_SECRET())) {
      return null;
    }

    const payload: DownloadTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Get SHA256 hash of a raw token (for DB lookup).
 */
export function hashToken(rawToken: string): string {
  return sha256(rawToken);
}
