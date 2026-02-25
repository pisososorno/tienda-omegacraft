import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_SUPER, logAudit } from "@/lib/rbac";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return jsonError("User not found", 404);

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.password) {
      updateData.passwordHash = await hash(parsed.data.password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return jsonError("No fields to update", 400);
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true },
    });

    await logAudit(req, auth.userId, parsed.data.password ? "password_changed" : "admin_user_updated", { fields: Object.keys(updateData) }, id);

    return jsonOk(updated);
  } catch (error) {
    console.error("[api/admin/users/id PATCH]", error);
    return jsonError("Internal server error", 500);
  }
}
