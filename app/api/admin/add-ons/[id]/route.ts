import { addOnUpdateSchema, updateAddOn } from "@/lib/admin/catalog";
import { adminMutation, parseId } from "@/lib/admin/route";
import { jsonError } from "@/lib/api";

// PATCH /api/admin/add-ons/:id — ແກ້ລາຄາ / ຊື່ / ເປີດ-ປິດ (code · ໜ່ວຍ ລັອກ — ຂໍ້ຕົກລົງ 52)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return jsonError(404, "not_found");
  return adminMutation("catalog.manage", req, addOnUpdateSchema, (body, actor) => updateAddOn(id, body, actor));
}
