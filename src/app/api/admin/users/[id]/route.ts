import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";
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
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return jsonError("User not found", 404);

    const actorId = (session.user as Record<string, unknown>).id as string;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

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

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetId: id,
        action: parsed.data.password ? "password_changed" : "admin_user_updated",
        metadata: { fields: Object.keys(updateData) },
        ipAddress: ip,
        userAgent: ua,
      },
    });

    return jsonOk(updated);
  } catch (error) {
    console.error("[api/admin/users/id PATCH]", error);
    return jsonError("Internal server error", 500);
  }
}
