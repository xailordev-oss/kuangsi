import { adminMutation, parseId } from "@/lib/admin/route";
import { jsonError } from "@/lib/api";
import { completeRefund, completeSchema } from "@/lib/refunds/cancel";

// POST /api/staff/refunds/:id/complete — ໂອນຄືນແລ້ວ (ເລກອ້າງອີງບັງຄັບ) · ບັນທຶກໄດ້ເທື່ອດຽວ
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return jsonError(404, "not_found");
  return adminMutation("refund.process", req, completeSchema, (body, actor) => completeRefund(id, body, actor));
}
