import { createTicketType, ticketCreateSchema } from "@/lib/admin/catalog";
import { adminMutation } from "@/lib/admin/route";

// POST /api/admin/ticket-types — ເພີ່ມປະເພດປີ້ (ຢືນຢັນລາຄາກ່ອນ — 409 confirm_required)
export async function POST(req: Request) {
  return adminMutation("catalog.manage", req, ticketCreateSchema, (body, actor) => createTicketType(body, actor), 201);
}
