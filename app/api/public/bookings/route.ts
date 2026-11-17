import { errorResponse, jsonError, parseJsonBody } from "@/lib/api";
import { grantBookingAccess } from "@/lib/booking/access";
import { createOnlineBooking } from "@/lib/booking/create";
import { findBookingByCode, toCustomerBookingDto } from "@/lib/booking/read";
import { createOnlineBookingSchema } from "@/lib/booking/schemas";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { getBankTransferInfo, getIntSetting } from "@/lib/settings";

// POST /api/public/bookings — ສ້າງການຈອງ online (status pending, ລໍໂອນ + ອັບໂຫຼດຫຼັກຖານ)
export async function POST(req: Request) {
  try {
    // ກັນ bot ສ້າງການຈອງ pending ໄປກັນບ່ອນ (ຂໍ້ຕົກລົງ 26) — ນັບທຸກຄັ້ງທີ່ພະຍາຍາມ
    const [limit, windowMinutes] = await Promise.all([
      getIntSetting("booking_create_limit_per_ip"),
      getIntSetting("booking_create_window_minutes"),
    ]);
    const rate = hitRateLimit(`booking-create:${clientIp(req.headers)}`, limit, windowMinutes * 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    // ຂໍ້ຕົກລົງ 28: ຍັງບໍ່ມີບັນຊີທະນາຄານ → ບໍ່ມີທາງຈ່າຍ → ບໍ່ສ້າງການຈອງ
    if (!(await getBankTransferInfo()).configured) return jsonError(503, "online_booking_unavailable");

    const body = await parseJsonBody(req, createOnlineBookingSchema);
    if (!body.ok) return body.response;

    const { booking_code } = await createOnlineBooking(body.data);
    await grantBookingAccess(booking_code);
    const booking = await findBookingByCode(booking_code);
    if (!booking) return jsonError(500, "internal");
    return Response.json(toCustomerBookingDto(booking), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
