import { errorResponse, jsonError, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { rejectProof } from "@/lib/payments/proofs";
import { paymentIdSchema, rejectSchema } from "@/lib/payments/schemas";

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const staff = await requirePermission("proof.verify");
    const id = paymentIdSchema.safeParse((await params).paymentId);
    if (!id.success) return jsonError(404, "not_found");
    const body = await parseJsonBody(req, rejectSchema);
    if (!body.ok) return body.response;
    return Response.json(await rejectProof(id.data, staff.id, body.data.reason));
  } catch (error) {
    return errorResponse(error);
  }
}
