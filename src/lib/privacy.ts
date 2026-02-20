import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.IP_ENCRYPTION_KEY;
  if (!key) throw new Error("IP_ENCRYPTION_KEY not set");
  // Accept hex (64 chars) or base64 (44 chars)
  if (key.length === 64) return Buffer.from(key, "hex");
  return Buffer.from(key, "base64");
}

/**
 * Encrypt a string (IP address) with AES-256-GCM.
 * Returns: iv(12) + ciphertext + authTag(16)
 */
export function encryptIp(ip: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(ip, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Decrypt AES-256-GCM encrypted IP.
 * Input format: iv(12) + ciphertext + authTag(16)
 */
export function decryptIp(encrypted: Buffer): string {
  const key = getEncryptionKey();
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(
    IV_LENGTH,
    encrypted.length - AUTH_TAG_LENGTH
  );
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Mask an IPv4 address: 190.123.45.67 → 190.xxx.xxx.xxx
 * Mask an IPv6 address: 2001:0db8:85a3::8a2e → 2001:xxxx:xxxx::xxxx
 */
export function maskIp(ip: string): string {
  if (!ip) return "";
  // IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.xxx.xxx.xxx`;
    }
  }
  // IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:xxxx:xxxx::xxxx`;
    }
  }
  return ip;
}

/**
 * Calculate retention expiry date (540 days from creation).
 */
export function calculateRetentionExpiry(createdAt: Date): Date {
  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + 540);
  return expiry;
}
