import { ticketUpdateSchema, updateTicketType } from "@/lib/admin/catalog";
import { adminMutation, parseId } from "@/lib/admin/route";
import { jsonError } from "@/lib/api";

// PATCH /api/admin/ticket-types/:id — ແກ້ລາຄາ / ຊື່ / ອາຍຸ / ລຳດັບ / ເປີດ-ປິດຂາຍ (code · ກຸ່ມ · ກຸ່ມອາຍຸ ລັອກ — ຂໍ້ຕົກລົງ 52)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return jsonError(404, "not_found");
  return adminMutation("catalog.manage", req, ticketUpdateSchema, (body, actor) => updateTicketType(id, body, actor));
}
