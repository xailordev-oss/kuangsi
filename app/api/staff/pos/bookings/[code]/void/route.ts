import { adminMutation } from "@/lib/admin/route";
import { jsonError } from "@/lib/api";
import { bookingCodeSchema } from "@/lib/booking/schemas";
import { posVoidSchema, voidGateSale } from "@/lib/refunds/cancel";

// POST /api/staff/pos/bookings/KS-XXXXX/void — ຍົກເລີກການຂາຍ POS ມື້ນີ້ ທີ່ຍັງບໍ່ສະແກນ · ຄືນເງິນສົດເຕັມ (ຂໍ້ຕົກລົງ 57)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = bookingCodeSchema.safeParse((await params).code);
  if (!code.success) return jsonError(404, "not_found");
  return adminMutation("refund.process", req, posVoidSchema, (body, actor) => voidGateSale(code.data, body, actor));
}
