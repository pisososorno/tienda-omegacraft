import { createHash, createHmac, randomBytes } from "crypto";
import { createReadStream } from "fs";

/**
 * SHA256 hash of a string.
 */
export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * SHA256 hash of a Buffer.
 */
export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * SHA256 hash of a file by path (streaming).
 */
export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * HMAC-SHA256 sign.
 */
export function hmacSign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * HMAC-SHA256 verify.
 */
export function hmacVerify(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expected = hmacSign(data, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && require("crypto").timingSafeEqual(a, b);
}

/**
 * Generate cryptographically secure random hex string.
 */
export function randomHex(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Generate order number: ORD-XXXXXX (alphanumeric uppercase).
 */
export function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let result = "ORD-";
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate license key: LIC-XXXX-XXXX-XXXX.
 */
export function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const parts: string[] = [];
  for (let p = 0; p < 3; p++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars[bytes[p * 4 + i] % chars.length];
    }
    parts.push(segment);
  }
  return `LIC-${parts.join("-")}`;
}
