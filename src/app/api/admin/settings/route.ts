import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { invalidateSettingsCache, invalidatePaypalModeCache, DEFAULT_APPEARANCE } from "@/lib/settings";
import type { AppearanceSettings } from "@/lib/settings";
import { withAdminAuth, isAuthError, ROLES_SUPER } from "@/lib/rbac";
import { invalidatePayPalTokenCache } from "@/lib/paypal";

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

    // PayPal — resolve credentials per mode from DB
    const ppMode = (row.paypalMode === "live" ? "live" : "sandbox") as "sandbox" | "live";

    // Sandbox credentials
    const sbClientId = process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "";
    const sbSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || "";
    const sbWebhookId = process.env.PAYPAL_SANDBOX_WEBHOOK_ID || process.env.PAYPAL_WEBHOOK_ID || "";

    // Live credentials
    const liveClientId = process.env.PAYPAL_LIVE_CLIENT_ID || "";
    const liveSecret = process.env.PAYPAL_LIVE_CLIENT_SECRET || "";
    const liveWebhookId = process.env.PAYPAL_LIVE_WEBHOOK_ID || "";

    // Active credentials (based on current mode)
    const activeClientId = ppMode === "live" ? liveClientId : sbClientId;
    const activeSecret = ppMode === "live" ? liveSecret : sbSecret;
    const activeWebhookId = ppMode === "live" ? liveWebhookId : sbWebhookId;

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
        mode: ppMode,
        clientIdConfigured: activeClientId.length > 0,
        clientIdMasked: activeClientId ? activeClientId.slice(0, 6) + "\u2026" + activeClientId.slice(-4) : "",
        secretConfigured: activeSecret.length > 0,
        webhookIdConfigured: activeWebhookId.length > 0,
        sandbox: {
          clientIdConfigured: sbClientId.length > 0,
          secretConfigured: sbSecret.length > 0,
          webhookIdConfigured: sbWebhookId.length > 0,
        },
        live: {
          clientIdConfigured: liveClientId.length > 0,
          secretConfigured: liveSecret.length > 0,
          webhookIdConfigured: liveWebhookId.length > 0,
        },
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

// POST /api/admin/settings — special actions (paypal mode toggle)
export async function POST(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "toggle_paypal_mode") {
      const { mode } = body;
      if (mode !== "sandbox" && mode !== "live") {
        return NextResponse.json({ error: "mode must be 'sandbox' or 'live'" }, { status: 400 });
      }

      // If switching to live, validate that live credentials exist
      if (mode === "live") {
        const liveClientId = process.env.PAYPAL_LIVE_CLIENT_ID || "";
        const liveSecret = process.env.PAYPAL_LIVE_CLIENT_SECRET || "";
        if (!liveClientId || !liveSecret) {
          return NextResponse.json({
            error: "No se puede cambiar a LIVE: faltan PAYPAL_LIVE_CLIENT_ID y/o PAYPAL_LIVE_CLIENT_SECRET en las variables de entorno del servidor.",
          }, { status: 400 });
        }
      }

      await prisma.siteSettings.upsert({
        where: { id: "default" },
        update: { paypalMode: mode },
        create: {
          id: "default",
          storeName: "TiendaDigital",
          paypalMode: mode,
        },
      });

      // Invalidate all caches so the new mode takes effect immediately
      invalidateSettingsCache();
      invalidatePaypalModeCache();
      invalidatePayPalTokenCache();

      console.log(`[settings] PayPal mode switched to ${mode.toUpperCase()} by ${auth.email}`);

      return NextResponse.json({
        success: true,
        paypalMode: mode,
        message: `PayPal mode switched to ${mode.toUpperCase()}`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/admin/settings]", err);
    return NextResponse.json({ error: "Error processing action" }, { status: 500 });
  }
}
