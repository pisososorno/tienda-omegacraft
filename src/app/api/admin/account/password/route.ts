import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";
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
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const { currentPassword, newPassword } = parsed.data;
    const actorId = (session.user as Record<string, unknown>).id as string;

    const admin = await prisma.adminUser.findUnique({ where: { id: actorId } });
    if (!admin) return jsonError("Account not found", 404);

    const valid = await compare(currentPassword, admin.passwordHash);
    if (!valid) return jsonError("Current password is incorrect", 403);

    const passwordHash = await hash(newPassword, 12);
    await prisma.adminUser.update({
      where: { id: actorId },
      data: { passwordHash },
    });

    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetId: actorId,
        action: "password_changed",
        metadata: { selfChange: true },
        ipAddress: ip,
        userAgent: ua,
      },
    });

    return jsonOk({ success: true });
  } catch (error) {
    console.error("[api/admin/account/password POST]", error);
    return jsonError("Internal server error", 500);
  }
}
