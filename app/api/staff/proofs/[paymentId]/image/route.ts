import { connection } from "next/server";
import { errorResponse, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { imageResponse, readProof } from "@/lib/payments/proof-storage";
import { proofNameForPayment } from "@/lib/payments/proofs";
import { paymentIdSchema } from "@/lib/payments/schemas";

// ຂໍ້ຕົກລົງ 29: ພະນັກງານເບິ່ງຮູບໄດ້ສະເພາະ admin ແລະ cashier (proof.verify)
export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  await connection();
  try {
    await requirePermission("proof.verify");
    const id = paymentIdSchema.safeParse((await params).paymentId);
    if (!id.success) return jsonError(404, "not_found");
    const name = await proofNameForPayment(id.data);
    const file = name ? await readProof(name) : null;
    return file ? imageResponse(file) : jsonError(404, "not_found");
  } catch (error) {
    return errorResponse(error);
  }
}
