import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_SUPER, logAudit } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  if (auth.userId === id) {
    return jsonError("Cannot disable your own account", 400);
  }

  try {
    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return jsonError("User not found", 404);

    const isDisabling = !target.disabledAt;
    const updated = await prisma.adminUser.update({
      where: { id },
      data: { disabledAt: isDisabling ? new Date() : null },
      select: { id: true, email: true, name: true, disabledAt: true },
    });

    await logAudit(req, auth.userId, isDisabling ? "admin_disabled" : "admin_enabled", { email: target.email }, id);

    return jsonOk(updated);
  } catch (error) {
    console.error("[api/admin/users/id/toggle POST]", error);
    return jsonError("Internal server error", 500);
  }
}
