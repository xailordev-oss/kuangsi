import { prisma } from "@/lib/db";
import { expireStaleBookings } from "@/lib/booking/availability";
import { dbDateToIso } from "@/lib/time";

const bookingInclude = {
  customers: { select: { full_name: true, phone: true } },
  booking_items: {
    include: { ticket_types: { select: { code: true, name_lo: true, name_en: true, name_zh: true, name_th: true, visitor_group: true, age_group: true } } },
    orderBy: { id: "asc" },
  },
  booking_add_ons: {
    include: { add_ons: { select: { code: true, name_lo: true, name_en: true, name_zh: true, name_th: true, unit: true } } },
    orderBy: { id: "asc" },
  },
  payments: {
    where: { status: "failed" },
    orderBy: { id: "desc" },
    take: 1,
    select: { reject_reason: true },
  },
} as const;

export async function findBookingByCode(code: string) {
  await expireStaleBookings(prisma, { booking_code: code });
  return prisma.bookings.findUnique({ where: { booking_code: code }, include: bookingInclude });
}

type BookingWithDetails = NonNullable<Awaited<ReturnType<typeof findBookingByCode>>>;

const names = (n: { name_lo: string; name_en: string; name_zh: string | null; name_th: string | null }) => ({
  lo: n.name_lo,
  en: n.name_en,
  zh: n.name_zh,
  th: n.name_th,
});

// ຂໍ້ມູນທີ່ລູກຄ້າເຈົ້າຂອງການຈອງເຫັນ — ບໍ່ມີ id_number (ຂໍ້ຕົກລົງ 5)
// qr_token ສົ່ງສະເພາະເມື່ອຈ່າຍແລ້ວ (QR ໃຊ້ໄດ້ສະເພາະ paid / used)
export function toCustomerBookingDto(b: BookingWithDetails) {
  const showQr = b.status === "paid" || b.status === "used";
  return {
    bookingCode: b.booking_code,
    status: b.status,
    channel: b.channel,
    visitDate: dbDateToIso(b.visit_date),
    expiresAt: b.status === "pending" ? (b.expires_at?.toISOString() ?? null) : null,
    currency: b.currency,
    subtotal: b.subtotal.toFixed(2),
    discount: b.discount.toFixed(2),
    total: b.total_amount.toFixed(2),
    people: b.booking_items.reduce((n, i) => n + i.quantity, 0),
    customer: b.customers ? { fullName: b.customers.full_name, phone: b.customers.phone } : null,
    items: b.booking_items.map((i) => ({
      ticketTypeCode: i.ticket_types.code,
      name: names(i.ticket_types),
      visitorGroup: i.ticket_types.visitor_group,
      ageGroup: i.ticket_types.age_group,
      quantity: i.quantity,
      unitPrice: i.unit_price.toFixed(2),
      lineTotal: i.line_total.toFixed(2),
    })),
    addOns: b.booking_add_ons.map((a) => ({
      addOnCode: a.add_ons.code,
      name: names(a.add_ons),
      unit: a.add_ons.unit,
      quantity: a.quantity,
      unitPrice: a.unit_price.toFixed(2),
      lineTotal: a.line_total.toFixed(2),
    })),
    lastRejectReason: b.status === "pending" ? (b.payments[0]?.reject_reason ?? null) : null,
    qrToken: showQr ? b.qr_token : null,
    createdAt: b.created_at.toISOString(),
  };
}
