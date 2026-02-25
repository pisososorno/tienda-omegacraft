import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, logAudit } from "@/lib/rbac";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

export async function POST(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const { currentPassword, newPassword } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { id: auth.userId } });
    if (!admin) return jsonError("Account not found", 404);

    const valid = await compare(currentPassword, admin.passwordHash);
    if (!valid) return jsonError("Current password is incorrect", 403);

    const passwordHash = await hash(newPassword, 12);
    await prisma.adminUser.update({
      where: { id: auth.userId },
      data: { passwordHash },
    });

    await logAudit(req, auth.userId, "password_changed", { selfChange: true }, auth.userId);

    return jsonOk({ success: true });
  } catch (error) {
    console.error("[api/admin/account/password POST]", error);
    return jsonError("Internal server error", 500);
  }
}
