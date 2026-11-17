import { errorResponse, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import encodeQR from "qr";
import { createGateSale } from "@/lib/booking/create";
import { linesOf } from "@/lib/scan/check-in";
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
        // QR ສ້າງຢູ່ server → ໜ້າ POS ບໍ່ຕ້ອງໂຫຼດ encoder (ຂໍ້ຕົກລົງ 42: ສະແດງເທິງຈໍໃຫ້ລູກຄ້າຖ່າຍຮູບ)
        qrSvg: booking ? encodeQR(booking.qr_token, "svg", { ecc: "medium", border: 4 }) : null,
        lines: booking ? linesOf(booking.booking_items.map((i) => ({ quantity: i.quantity, ticket_types: i.ticket_types }))) : [],
        cashReceived: sale.change.add(sale.total).toFixed(2),
        change: sale.change.toFixed(2),
        checkedIn: sale.checkedIn,
        replayed: sale.replayed,
      },
      { status: sale.replayed ? 200 : 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
