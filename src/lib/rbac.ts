import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getClientIp, getUserAgent, jsonError } from "@/lib/api-helpers";
import type { UserRole, SellerStatus, ProductCategory } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  sellerId: string | null;
  sellerStatus: SellerStatus | null;
  sellerCategories: ProductCategory[];
}

export interface AuthOptions {
  roles: UserRole[];
  /** If true and role=SELLER, verifies seller profile exists and is not disabled */
  requireActiveSeller?: boolean;
}

// ── Category permission mapping ──────────────────────────────────

const CATEGORY_FLAG_MAP: Record<ProductCategory, string> = {
  plugins: "canSellPlugins",
  maps: "canSellMaps",
  configurations: "canSellConfigurations",
  source_code: "canSellSourceCode",
};

// ── Core auth helper ─────────────────────────────────────────────

/**
 * Unified auth guard for ALL /api/admin/* routes.
 * Returns AuthContext on success, or a Response (401/403) on failure.
 */
export async function withAdminAuth(
  req: NextRequest | null,
  options: AuthOptions
): Promise<AuthContext | Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return jsonError("Unauthorized", 401);
  }

  const user = session.user as Record<string, unknown>;
  const userId = user.id as string;
  const role = (user.role as UserRole) || "SELLER";
  const email = (user.email as string) || "";
  const name = (user.name as string) || "";

  // Role check
  if (!options.roles.includes(role)) {
    // Log forbidden access attempt
    if (req) {
      await logForbiddenAccess(req, userId, role, options.roles);
    }
    return jsonError("Forbidden", 403);
  }

  // Build context
  let sellerId: string | null = null;
  let sellerStatus: SellerStatus | null = null;
  let sellerCategories: ProductCategory[] = [];

  if (role === "SELLER") {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (profile) {
      sellerId = profile.id;
      sellerStatus = profile.status;
      sellerCategories = getAllowedCategories(profile);
    }

    // If route requires active seller, enforce it
    if (options.requireActiveSeller) {
      if (!profile) {
        return jsonError("Seller profile not found. Contact admin.", 403);
      }
      if (profile.status === "disabled" || profile.status === "suspended") {
        return jsonError("Seller account is " + profile.status + ". Contact admin.", 403);
      }
    }
  }

  return {
    userId,
    email,
    name,
    role,
    sellerId,
    sellerStatus,
    sellerCategories,
  };
}

/**
 * Type guard: checks if withAdminAuth returned a Response (error) vs AuthContext
 */
export function isAuthError(result: AuthContext | Response): result is Response {
  return result instanceof Response;
}

// ── Role checks ──────────────────────────────────────────────────

export function isSuperAdmin(ctx: AuthContext): boolean {
  return ctx.role === "SUPER_ADMIN";
}

export function isStoreAdminOrAbove(ctx: AuthContext): boolean {
  return ctx.role === "SUPER_ADMIN" || ctx.role === "STORE_ADMIN";
}

export function isSeller(ctx: AuthContext): boolean {
  return ctx.role === "SELLER";
}

// ── Seller category checks ───────────────────────────────────────

function getAllowedCategories(profile: {
  canSellPlugins: boolean;
  canSellMaps: boolean;
  canSellConfigurations: boolean;
  canSellSourceCode: boolean;
}): ProductCategory[] {
  const cats: ProductCategory[] = [];
  if (profile.canSellPlugins) cats.push("plugins");
  if (profile.canSellMaps) cats.push("maps");
  if (profile.canSellConfigurations) cats.push("configurations");
  if (profile.canSellSourceCode) cats.push("source_code");
  return cats;
}

export function canSellCategory(ctx: AuthContext, category: ProductCategory): boolean {
  if (ctx.role !== "SELLER") return true; // admins can use any category
  return ctx.sellerCategories.includes(category);
}

export function getCategoryFlagName(category: ProductCategory): string {
  return CATEGORY_FLAG_MAP[category] || category;
}

// ── Product ownership scoping ────────────────────────────────────

/**
 * Returns Prisma WHERE filter for products based on role.
 * SELLER: only their products. Others: all products.
 */
export function scopeProductsWhere(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role === "SELLER") {
    return { sellerId: ctx.sellerId };
  }
  return {};
}

/**
 * Verifies that the given product belongs to the seller (or user is admin).
 * Returns the product if authorized, or null.
 */
export async function verifyProductOwnership(
  ctx: AuthContext,
  productId: string
): Promise<{ id: string; sellerId: string | null } | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true },
  });

  if (!product) return null;

  if (ctx.role === "SELLER") {
    if (product.sellerId !== ctx.sellerId) return null;
  }

  return product;
}

// ── Order scoping ────────────────────────────────────────────────

/**
 * Returns Prisma WHERE filter for orders based on role.
 * SELLER: only orders for their products.
 */
export function scopeOrdersWhere(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role === "SELLER") {
    return {
      product: { sellerId: ctx.sellerId },
    };
  }
  return {};
}

/**
 * Verifies that the given order belongs to a product owned by the seller.
 */
export async function verifyOrderOwnership(
  ctx: AuthContext,
  orderId: string
): Promise<boolean> {
  if (ctx.role !== "SELLER") return true;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { product: { select: { sellerId: true } } },
  });

  if (!order) return false;
  return order.product.sellerId === ctx.sellerId;
}

// ── Audit logging ────────────────────────────────────────────────

async function logForbiddenAccess(
  req: NextRequest,
  userId: string,
  userRole: UserRole,
  requiredRoles: UserRole[]
): Promise<void> {
  try {
    const ip = getClientIp(req);
    const ua = getUserAgent(req);
    const url = new URL(req.url);

    await prisma.adminAuditLog.create({
      data: {
        actorId: userId,
        action: "forbidden_access_attempt",
        metadata: {
          path: url.pathname,
          method: req.method,
          userRole,
          requiredRoles,
        },
        ipAddress: ip,
        userAgent: ua,
      },
    });
  } catch (err) {
    console.error("[rbac] Failed to log forbidden access:", err);
  }
}

export async function logAudit(
  req: NextRequest | null,
  actorId: string,
  action: string,
  metadata: Record<string, unknown> = {},
  targetId?: string
): Promise<void> {
  try {
    const ip = req ? getClientIp(req) : null;
    const ua = req ? getUserAgent(req) : null;

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetId: targetId || null,
        action,
        metadata: metadata as Record<string, string | number | boolean | null>,
        ipAddress: ip,
        userAgent: ua,
      },
    });
  } catch (err) {
    console.error("[rbac] Audit log failed:", err);
  }
}

// ── Constants for route configuration ────────────────────────────

export const ROLES_ALL: UserRole[] = ["SUPER_ADMIN", "STORE_ADMIN", "SELLER"];
export const ROLES_ADMIN: UserRole[] = ["SUPER_ADMIN", "STORE_ADMIN"];
export const ROLES_SUPER: UserRole[] = ["SUPER_ADMIN"];
