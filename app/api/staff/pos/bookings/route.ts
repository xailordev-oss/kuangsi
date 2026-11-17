import { errorResponse, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createGateSale } from "@/lib/booking/create";
import { findBookingByCode, toCustomerBookingDto } from "@/lib/booking/read";
import { posSaleSchema } from "@/lib/booking/schemas";

// POST /api/staff/pos/bookings — ຂາຍປີ້ໜ້າປະຕູ (cashier, admin)
export async function POST(req: Request) {
  try {
    const staff = await requirePermission("pos.sell");
    const body = await parseJsonBody(req, posSaleSchema);
    if (!body.ok) return body.response;

    const sale = await createGateSale({ ...body.data, staffId: staff.id });
    const booking = await findBookingByCode(sale.bookingCode);
    return Response.json(
      {
        booking: booking ? { ...toCustomerBookingDto(booking), qrToken: booking.qr_token } : null,
        cashReceived: body.data.cashReceived.toFixed(2),
        change: sale.change.toFixed(2),
        checkedIn: sale.checkedIn,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
