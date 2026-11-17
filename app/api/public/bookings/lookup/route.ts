import { errorResponse, jsonError, parseJsonBody } from "@/lib/api";
import { grantBookingAccess } from "@/lib/booking/access";
import { findBookingByCode, toCustomerBookingDto } from "@/lib/booking/read";
import { lookupSchema } from "@/lib/booking/schemas";

// POST /api/public/bookings/lookup — ລະຫັດຈອງ + ເບີໂທ (ຂໍ້ຕົກລົງ 12, 19)
// ບໍ່ພົບ ຫຼື ເບີບໍ່ກົງ → ຕອບແບບດຽວກັນ ບໍ່ບອກວ່າອັນໃດຜິດ
export async function POST(req: Request) {
  const body = await parseJsonBody(req, lookupSchema);
  if (!body.ok) return body.response;
  try {
    const booking = await findBookingByCode(body.data.bookingCode);
    if (!booking?.customers?.phone || booking.customers.phone !== body.data.phone) {
      return jsonError(404, "not_found");
    }
    await grantBookingAccess(booking.booking_code);
    return Response.json(toCustomerBookingDto(booking));
  } catch (error) {
    return errorResponse(error);
  }
}
