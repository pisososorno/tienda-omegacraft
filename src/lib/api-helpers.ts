import { NextRequest } from "next/server";

/**
 * Extract client IP from request headers.
 * Checks X-Forwarded-For, X-Real-IP, then falls back to "unknown".
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Extract user agent from request.
 */
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}

/**
 * Standard JSON error response.
 */
export function jsonError(message: string, status: number = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * Standard JSON success response.
 */
export function jsonOk(data: unknown, status: number = 200) {
  return Response.json(data, { status });
}
