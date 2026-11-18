import { adminMutation } from "@/lib/admin/route";
import { jsonError } from "@/lib/api";
import { bookingCodeSchema } from "@/lib/booking/schemas";
import { adminCancelSchema, cancelByAdmin } from "@/lib/refunds/cancel";

// POST /api/admin/bookings/KS-XXXXX/cancel — admin: ຕາມນະໂຍບາຍ / ເຕັມ / ກຳນົດເອງ + ເຫດຜົນບັງຄັບ (ຂໍ້ຕົກລົງ 54)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = bookingCodeSchema.safeParse((await params).code);
  if (!code.success) return jsonError(404, "not_found");
  return adminMutation("booking.manage", req, adminCancelSchema, (body, actor) => cancelByAdmin(code.data, body, actor));
}
