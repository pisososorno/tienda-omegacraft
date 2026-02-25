import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withAdminAuth, isAuthError, ROLES_ALL, ROLES_SUPER } from "@/lib/rbac";
import crypto from "crypto";

// GET /api/admin/terms — load active terms version
export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  try {
    const terms = await prisma.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!terms) {
      return NextResponse.json({ content: "", versionLabel: "v1.0", exists: false });
    }

    return NextResponse.json({
      id: terms.id,
      content: terms.content,
      versionLabel: terms.versionLabel,
      contentHash: terms.contentHash,
      exists: true,
    });
  } catch (err) {
    console.error("[GET /api/admin/terms]", err);
    return NextResponse.json({ error: "Error loading terms" }, { status: 500 });
  }
}

// PUT /api/admin/terms — save new terms version
export async function PUT(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const { content, versionLabel } = body;

    if (!content || typeof content !== "string" || content.trim().length < 10) {
      return NextResponse.json({ error: "El contenido es obligatorio (mínimo 10 caracteres)" }, { status: 400 });
    }

    const label = (versionLabel || "v1.0").trim();
    const contentHash = crypto.createHash("sha256").update(content.trim()).digest("hex");

    // Deactivate all current versions
    await prisma.termsVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new active version
    const terms = await prisma.termsVersion.create({
      data: {
        versionLabel: label,
        content: content.trim(),
        contentHash,
        isActive: true,
      },
    });

    // Revalidate public pages
    revalidatePath("/terms");
    revalidatePath("/privacy");

    return NextResponse.json({
      success: true,
      id: terms.id,
      versionLabel: terms.versionLabel,
      contentHash: terms.contentHash,
    });
  } catch (err) {
    console.error("[PUT /api/admin/terms]", err);
    return NextResponse.json({ error: "Error saving terms" }, { status: 500 });
  }
}
