import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";
import { hash } from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      disabledAt: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const { email, name, password } = parsed.data;

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) return jsonError("Email already in use", 409);

    const passwordHash = await hash(password, 12);
    const user = await prisma.adminUser.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const actorId = (session.user as Record<string, unknown>).id as string;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetId: user.id,
        action: "admin_user_created",
        metadata: { email, name },
        ipAddress: ip,
        userAgent: ua,
      },
    });

    return jsonOk(user, 201);
  } catch (error) {
    console.error("[api/admin/users POST]", error);
    return jsonError("Internal server error", 500);
  }
}
