import { connection } from "next/server";
import { errorResponse, jsonError } from "@/lib/api";
import { hasBookingAccess } from "@/lib/booking/access";
import { findBookingByCode, toCustomerBookingDto } from "@/lib/booking/read";
import { bookingCodeSchema } from "@/lib/booking/schemas";

// GET /api/public/bookings/KS-XXXXX — ຕ້ອງມີ cookie ສິດ (ຂໍ້ຕົກລົງ 19)
// ບໍ່ມີສິດ ແລະ ບໍ່ມີການຈອງ → 404 ແບບດຽວກັນ (ບໍ່ບອກວ່າລະຫັດມີຢູ່)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  await connection();
  const code = bookingCodeSchema.safeParse((await params).code);
  if (!code.success) return jsonError(404, "not_found");
  try {
    if (!(await hasBookingAccess(code.data))) return jsonError(404, "not_found");
    const booking = await findBookingByCode(code.data);
    if (!booking) return jsonError(404, "not_found");
    return Response.json(toCustomerBookingDto(booking));
  } catch (error) {
    return errorResponse(error);
  }
}
