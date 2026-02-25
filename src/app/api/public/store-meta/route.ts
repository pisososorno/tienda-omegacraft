import { prisma } from "@/lib/prisma";
import { DEFAULT_APPEARANCE } from "@/lib/settings";
import type { AppearanceSettings } from "@/lib/settings";
import { jsonOk, jsonError } from "@/lib/api-helpers";

// GET /api/public/store-meta — public read-only store metadata (no auth)
export async function GET() {
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: "default" },
    });

    if (!row) {
      return jsonOk({
        storeName: "TiendaDigital",
        storeSlogan: "",
        logoUrl: null,
        heroTitle: null,
        heroDescription: null,
        appearance: DEFAULT_APPEARANCE,
      });
    }

    const appearance: AppearanceSettings = {
      ...DEFAULT_APPEARANCE,
      ...((row.appearance ?? {}) as Record<string, unknown>),
    };

    return jsonOk({
      storeName: row.storeName,
      storeSlogan: row.storeSlogan,
      logoUrl: row.logoUrl,
      heroTitle: row.heroTitle,
      heroDescription: row.heroDescription,
      appearance,
    });
  } catch (error) {
    console.error("[api/public/store-meta]", error);
    return jsonError("Internal server error", 500);
  }
}
