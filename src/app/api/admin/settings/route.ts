import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateSettingsCache, DEFAULT_APPEARANCE } from "@/lib/settings";
import type { AppearanceSettings } from "@/lib/settings";

// GET /api/admin/settings — load current settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let row = await prisma.siteSettings.findUnique({
      where: { id: "default" },
    });

    if (!row) {
      // Create default row if it doesn't exist
      row = await prisma.siteSettings.create({
        data: {
          id: "default",
          storeName: "TiendaDigital",
          storeSlogan: "Productos digitales premium para Minecraft",
          contactEmail: "support@tiendadigital.com",
          privacyEmail: "privacy@tiendadigital.com",
          appearance: JSON.parse(JSON.stringify(DEFAULT_APPEARANCE)),
        },
      });
    }

    const appearance: AppearanceSettings = {
      ...DEFAULT_APPEARANCE,
      ...((row.appearance ?? {}) as Record<string, unknown>),
    };

    return NextResponse.json({
      storeName: row.storeName,
      logoUrl: row.logoUrl,
      storeSlogan: row.storeSlogan,
      contactEmail: row.contactEmail,
      privacyEmail: row.privacyEmail,
      heroTitle: row.heroTitle,
      heroDescription: row.heroDescription,
      appearance,
    });
  } catch (err) {
    console.error("[GET /api/admin/settings]", err);
    return NextResponse.json({ error: "Error loading settings" }, { status: 500 });
  }
}

// PUT /api/admin/settings — save settings
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      storeName,
      logoUrl,
      storeSlogan,
      contactEmail,
      privacyEmail,
      heroTitle,
      heroDescription,
      appearance,
    } = body;

    // Validate required fields
    if (!storeName || typeof storeName !== "string" || storeName.trim().length === 0) {
      return NextResponse.json({ error: "storeName is required" }, { status: 400 });
    }

    // Merge appearance with defaults to ensure all keys exist
    const mergedAppearance: AppearanceSettings = {
      ...DEFAULT_APPEARANCE,
      ...(appearance ?? {}),
    };

    const row = await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: {
        storeName: storeName.trim(),
        logoUrl: logoUrl ?? null,
        storeSlogan: (storeSlogan ?? "").trim(),
        contactEmail: (contactEmail ?? "").trim(),
        privacyEmail: (privacyEmail ?? "").trim(),
        heroTitle: (heroTitle ?? "").trim(),
        heroDescription: (heroDescription ?? "").trim(),
        appearance: JSON.parse(JSON.stringify(mergedAppearance)),
      },
      create: {
        id: "default",
        storeName: storeName.trim(),
        logoUrl: logoUrl ?? null,
        storeSlogan: (storeSlogan ?? "").trim(),
        contactEmail: (contactEmail ?? "").trim(),
        privacyEmail: (privacyEmail ?? "").trim(),
        heroTitle: (heroTitle ?? "").trim(),
        heroDescription: (heroDescription ?? "").trim(),
        appearance: JSON.parse(JSON.stringify(mergedAppearance)),
      },
    });

    // Invalidate server-side cache
    invalidateSettingsCache();

    return NextResponse.json({
      success: true,
      storeName: row.storeName,
      logoUrl: row.logoUrl,
      storeSlogan: row.storeSlogan,
      contactEmail: row.contactEmail,
      privacyEmail: row.privacyEmail,
      heroTitle: row.heroTitle,
      heroDescription: row.heroDescription,
      appearance: mergedAppearance,
    });
  } catch (err) {
    console.error("[PUT /api/admin/settings]", err);
    return NextResponse.json({ error: "Error saving settings" }, { status: 500 });
  }
}
