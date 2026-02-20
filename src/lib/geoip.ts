/**
 * IP Geolocation lookup using free ip-api.com service.
 * Falls back gracefully if the service is unavailable.
 * Rate limit: 45 requests/minute on free tier (sufficient for most stores).
 */

export interface GeoIpResult {
  country: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
}

const EMPTY_RESULT: GeoIpResult = {
  country: null,
  city: null,
  region: null,
  countryCode: null,
};

/**
 * Resolve an IP address to country/city.
 * Non-blocking, never throws — returns empty result on failure.
 */
export async function resolveGeoIp(ip: string): Promise<GeoIpResult> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { country: "Local", city: "localhost", region: null, countryCode: "LO" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!res.ok) return EMPTY_RESULT;

    const data = await res.json();

    if (data.status !== "success") return EMPTY_RESULT;

    return {
      country: data.country || null,
      city: data.city || null,
      region: data.regionName || null,
      countryCode: data.countryCode || null,
    };
  } catch {
    // Network error, timeout, or API down — continue without geo data
    return EMPTY_RESULT;
  }
}
