import { prisma } from "@/lib/prisma";

// ── Default appearance values ─────────────────────────────
export interface AppearanceSettings {
  primaryColor: string;
  accentColor: string;
  navbarBg: string;
  navbarText: string;
  heroBgType: "gradient" | "solid" | "image";
  heroBgGradient: string;
  heroBgSolid: string;
  heroBgImage: string;
  heroBgImageOpacity: number;
  heroBgImageSize: number;
  bodyBg: string;
  cardBg: string;
  footerBg: string;
  footerText: string;
  catalogBg: string;
  logoHeight: number;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  primaryColor: "#6366f1",
  accentColor: "#818cf8",
  navbarBg: "#ffffff",
  navbarText: "#0f172a",
  heroBgType: "gradient",
  heroBgGradient: "from-slate-900 via-indigo-950 to-slate-900",
  heroBgSolid: "#0f172a",
  heroBgImage: "",
  heroBgImageOpacity: 40,
  heroBgImageSize: 100,
  bodyBg: "#ffffff",
  cardBg: "#ffffff",
  footerBg: "#0f172a",
  footerText: "#f8fafc",
  catalogBg: "#f8fafc",
  logoHeight: 32,
};

export interface SiteSettingsData {
  storeName: string;
  logoUrl: string | null;
  storeSlogan: string;
  contactEmail: string;
  privacyEmail: string;
  heroTitle: string;
  heroDescription: string;
  appearance: AppearanceSettings;
}

export const DEFAULT_SETTINGS: SiteSettingsData = {
  storeName: "TiendaDigital",
  logoUrl: null,
  storeSlogan: "Productos digitales premium para Minecraft",
  contactEmail: "support@tiendadigital.com",
  privacyEmail: "privacy@tiendadigital.com",
  heroTitle: "Plugins, Maps y Configs de calidad profesional",
  heroDescription: "Descubre nuestra colección de productos digitales para Minecraft. Spawns, dungeons, plugins y source code — todo con entrega instantánea y soporte incluido.",
  appearance: DEFAULT_APPEARANCE,
};

// ── In-memory cache (TTL 60s) ─────────────────────────────
let cachedSettings: SiteSettingsData | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export function invalidateSettingsCache() {
  cachedSettings = null;
  cacheExpiry = 0;
}

/**
 * Read site settings from DB with fallback to defaults.
 * Cached for 60 seconds to avoid hitting DB on every page render.
 */
export async function getSettings(): Promise<SiteSettingsData> {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiry) {
    return cachedSettings;
  }

  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: "default" },
    });

    if (row) {
      const rawAppearance = (row.appearance ?? {}) as Record<string, unknown>;
      const appearance: AppearanceSettings = {
        ...DEFAULT_APPEARANCE,
        ...rawAppearance,
      };

      const settings: SiteSettingsData = {
        storeName: row.storeName,
        logoUrl: row.logoUrl,
        storeSlogan: row.storeSlogan,
        contactEmail: row.contactEmail,
        privacyEmail: row.privacyEmail,
        heroTitle: row.heroTitle,
        heroDescription: row.heroDescription,
        appearance,
      };

      cachedSettings = settings;
      cacheExpiry = now + CACHE_TTL_MS;
      return settings;
    }
  } catch (err) {
    console.error("[getSettings] DB error, using defaults:", err);
  }

  cachedSettings = DEFAULT_SETTINGS;
  cacheExpiry = now + CACHE_TTL_MS;
  return DEFAULT_SETTINGS;
}

// ── PayPal mode cache (separate, short TTL) ─────────────
let cachedPaypalMode: string | null = null;
let paypalModeCacheExpiry = 0;
const PAYPAL_MODE_CACHE_TTL_MS = 30_000; // 30s

export function invalidatePaypalModeCache() {
  cachedPaypalMode = null;
  paypalModeCacheExpiry = 0;
}

/**
 * Get the active PayPal mode ("sandbox" | "live") from DB.
 * Falls back to PAYPAL_MODE env var, then "sandbox".
 */
export async function getPaypalMode(): Promise<"sandbox" | "live"> {
  const now = Date.now();
  if (cachedPaypalMode && now < paypalModeCacheExpiry) {
    return cachedPaypalMode as "sandbox" | "live";
  }

  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: { paypalMode: true },
    });
    const mode = row?.paypalMode === "live" ? "live" : "sandbox";
    cachedPaypalMode = mode;
    paypalModeCacheExpiry = now + PAYPAL_MODE_CACHE_TTL_MS;
    return mode;
  } catch {
    const fallback = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
    cachedPaypalMode = fallback;
    paypalModeCacheExpiry = now + PAYPAL_MODE_CACHE_TTL_MS;
    return fallback;
  }
}

/**
 * Replace store name, contact emails and placeholders in legal/terms content.
 * Handles both hardcoded defaults and {{PLACEHOLDER}} tokens.
 */
export function injectSettingsIntoContent(
  content: string,
  settings: SiteSettingsData
): string {
  return content
    // Placeholder tokens (used in seed)
    .replaceAll("{{STORE_NAME}}", settings.storeName)
    .replaceAll("{{CONTACT_EMAIL}}", settings.contactEmail)
    .replaceAll("{{PRIVACY_EMAIL}}", settings.privacyEmail)
    // Legacy hardcoded defaults (backward compat with old DB content)
    .replaceAll("TiendaDigital", settings.storeName)
    .replaceAll("support@tiendadigital.com", settings.contactEmail)
    .replaceAll("privacy@tiendadigital.com", settings.privacyEmail);
}

/**
 * Split store name into brand parts for styled rendering.
 * E.g. "TiendaDigital" → { prefix: "Tienda", highlight: "Digital" }
 * E.g. "MyShop Online" → { prefix: "MyShop", highlight: "Online" }
 */
export function splitStoreName(name: string): { prefix: string; highlight: string } {
  // Try camelCase split: "TiendaDigital" → ["Tienda", "Digital"]
  const camelParts = name.match(/[A-Z][a-z]+/g);
  if (camelParts && camelParts.length >= 2) {
    const highlight = camelParts[camelParts.length - 1];
    const prefix = name.slice(0, name.lastIndexOf(highlight));
    return { prefix, highlight };
  }

  // Try space split: "My Shop" → ["My", "Shop"]
  const spaceParts = name.split(/\s+/);
  if (spaceParts.length >= 2) {
    const highlight = spaceParts[spaceParts.length - 1];
    const prefix = spaceParts.slice(0, -1).join(" ");
    return { prefix, highlight };
  }

  return { prefix: name, highlight: "" };
}
