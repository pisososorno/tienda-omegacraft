import { NextRequest } from "next/server";
import { verifyChain } from "@/lib/forensic";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ADMIN } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  try {
    const result = await verifyChain(id);
    return jsonOk(result);
  } catch (error) {
    console.error("[admin/orders/id/verify-chain]", error);
    return jsonError("Internal server error", 500);
  }
}
