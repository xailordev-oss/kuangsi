import { errorResponse, jsonError, parseJsonBody } from "@/lib/api";
import { hasBookingAccess } from "@/lib/booking/access";
import { bookingCodeSchema } from "@/lib/booking/schemas";
import { clientIp } from "@/lib/rate-limit";
import { cancelByCustomer, customerCancelSchema } from "@/lib/refunds/cancel";

// POST /api/public/bookings/KS-XXXXX/cancel — ລູກຄ້າຍົກເລີກເອງ ຕາມນະໂຍບາຍ (ຂໍ້ຕົກລົງ 54)
// ສິດ = cookie ຈາກການຈອງ ຫຼື ລະຫັດ + ເບີໂທ (ຂໍ້ຕົກລົງ 19) · ບໍ່ມີສິດ = 404 ແບບດຽວກັບບໍ່ພົບ
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = bookingCodeSchema.safeParse((await params).code);
  if (!code.success) return jsonError(404, "not_found");
  try {
    if (!(await hasBookingAccess(code.data))) return jsonError(404, "not_found");
    const body = await parseJsonBody(req, customerCancelSchema);
    if (!body.ok) return body.response;
    const result = await cancelByCustomer(code.data, body.data, clientIp(req.headers));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
