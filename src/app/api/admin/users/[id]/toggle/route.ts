import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  const actorId = (session.user as Record<string, unknown>).id as string;

  if (actorId === id) {
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

    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetId: id,
        action: isDisabling ? "admin_disabled" : "admin_enabled",
        metadata: { email: target.email },
        ipAddress: ip,
        userAgent: ua,
      },
    });

    return jsonOk(updated);
  } catch (error) {
    console.error("[api/admin/users/id/toggle POST]", error);
    return jsonError("Internal server error", 500);
  }
}
