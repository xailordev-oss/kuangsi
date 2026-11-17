import { connection } from "next/server";
import { errorResponse } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { listProofQueue } from "@/lib/payments/proofs";

// GET /api/staff/proofs — ລາຍການລໍກວດ (cashier, admin)
export async function GET() {
  await connection();
  try {
    await requirePermission("proof.verify");
    return Response.json({ items: await listProofQueue() });
  } catch (error) {
    return errorResponse(error);
  }
}
