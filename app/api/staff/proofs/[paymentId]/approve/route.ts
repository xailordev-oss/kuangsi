import { errorResponse, jsonError, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { approveProof } from "@/lib/payments/proofs";
import { approveSchema, paymentIdSchema } from "@/lib/payments/schemas";

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const staff = await requirePermission("proof.verify");
    const id = paymentIdSchema.safeParse((await params).paymentId);
    if (!id.success) return jsonError(404, "not_found");
    const body = await parseJsonBody(req, approveSchema);
    if (!body.ok) return body.response;
    return Response.json(await approveProof(id.data, staff.id, body.data.transactionId));
  } catch (error) {
    return errorResponse(error);
  }
}
