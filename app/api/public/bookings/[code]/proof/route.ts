import { connection } from "next/server";
import { errorResponse, jsonError } from "@/lib/api";
import { hasBookingAccess } from "@/lib/booking/access";
import { bookingCodeSchema } from "@/lib/booking/schemas";
import { imageResponse, readProof } from "@/lib/payments/proof-storage";
import { latestProofName, submitProof } from "@/lib/payments/proofs";

type Ctx = { params: Promise<{ code: string }> };

// ຂໍ້ຕົກລົງ 19, 29: ສະເພາະ browser ທີ່ມີ cookie ສິດ (ຈອງເອງ ຫຼື ຢືນຢັນລະຫັດ + ເບີໂທແລ້ວ)
async function authorizedCode(ctx: Ctx): Promise<string | null> {
  const code = bookingCodeSchema.safeParse((await ctx.params).code);
  if (!code.success) return null;
  return (await hasBookingAccess(code.data)) ? code.data : null;
}

// POST multipart/form-data: proof=<ຮູບ>
export async function POST(req: Request, ctx: Ctx) {
  try {
    const code = await authorizedCode(ctx);
    if (!code) return jsonError(404, "not_found");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, "invalid_form");
    }
    const file = form.get("proof");
    if (!(file instanceof File)) return jsonError(400, "validation", { issues: [{ path: "proof", message: "file required" }] });
    await submitProof(code, file);
    return Response.json({ status: "verifying" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET → ຮູບຫຼັກຖານຫຼ້າສຸດຂອງການຈອງນີ້
export async function GET(_req: Request, ctx: Ctx) {
  await connection();
  try {
    const code = await authorizedCode(ctx);
    if (!code) return jsonError(404, "not_found");
    const name = await latestProofName(code);
    const file = name ? await readProof(name) : null;
    return file ? imageResponse(file) : jsonError(404, "not_found");
  } catch (error) {
    return errorResponse(error);
  }
}
