import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { invalidateSettingsCache, DEFAULT_APPEARANCE } from "@/lib/settings";
import type { AppearanceSettings } from "@/lib/settings";
import { withAdminAuth, isAuthError, ROLES_SUPER } from "@/lib/rbac";

// GET /api/admin/settings — load current settings
export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

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

    // PayPal env status (masked, never expose secrets)
    const ppClientId = process.env.PAYPAL_CLIENT_ID || "";
    const ppSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    const ppMode = process.env.PAYPAL_MODE || "sandbox";
    const ppWebhookId = process.env.PAYPAL_WEBHOOK_ID || "";

    return NextResponse.json({
      storeName: row.storeName,
      logoUrl: row.logoUrl,
      storeSlogan: row.storeSlogan,
      contactEmail: row.contactEmail,
      privacyEmail: row.privacyEmail,
      heroTitle: row.heroTitle,
      heroDescription: row.heroDescription,
      appearance,
      paypal: {
        clientIdConfigured: ppClientId.length > 0,
        clientIdMasked: ppClientId ? ppClientId.slice(0, 6) + "…" + ppClientId.slice(-4) : "",
        secretConfigured: ppSecret.length > 0,
        webhookIdConfigured: ppWebhookId.length > 0,
        mode: ppMode,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/settings]", err);
    return NextResponse.json({ error: "Error loading settings" }, { status: 500 });
  }
}

// PUT /api/admin/settings — save settings
export async function PUT(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

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

    // Invalidate server-side cache + Next.js page cache
    invalidateSettingsCache();
    revalidatePath("/", "layout");

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
