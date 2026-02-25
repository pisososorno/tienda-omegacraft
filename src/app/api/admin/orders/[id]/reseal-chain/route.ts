import { NextRequest } from "next/server";
import { resealChain, verifyChain } from "@/lib/forensic";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_SUPER, logAudit } from "@/lib/rbac";

/**
 * POST /api/admin/orders/[id]/reseal-chain
 * Re-seals the event chain using canonical JSON serialization.
 * SUPER_ADMIN only — this modifies stored hashes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    // Re-seal
    const result = await resealChain(id);

    // Verify after re-seal
    const verification = await verifyChain(id);

    // Audit log
    await logAudit(req, auth.userId, "chain_resealed", {
      orderId: id,
      eventsResealed: result.resealed,
      totalEvents: result.totalEvents,
      chainValidAfter: verification.valid,
    });

    return jsonOk({
      resealed: result.resealed,
      totalEvents: result.totalEvents,
      chainValidAfter: verification.valid,
    });
  } catch (error) {
    console.error("[admin/orders/id/reseal-chain]", error);
    return jsonError("Internal server error", 500);
  }
}
