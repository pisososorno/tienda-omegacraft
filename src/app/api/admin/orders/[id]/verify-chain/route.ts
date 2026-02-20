import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyChain } from "@/lib/forensic";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const result = await verifyChain(id);
    return jsonOk(result);
  } catch (error) {
    console.error("[admin/orders/id/verify-chain]", error);
    return jsonError("Internal server error", 500);
  }
}
