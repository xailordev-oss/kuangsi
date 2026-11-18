import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { maskPhone } from "@/lib/admin/mask";
import { normalizePhone } from "@/lib/phone";
import { dbDateToIso, isoDateToDb, isValidIsoDate } from "@/lib/time";

export const PAGE_SIZE = 50;
const STATUSES = ["pending", "verifying", "paid", "used", "cancelled", "expired"] as const;
const CHANNELS = ["online", "gate", "tour_agency"] as const;

const isoDate = z.string().refine(isValidIsoDate);
// ຕົວກັ່ນຕອງມາຈາກ URL (searchParams) — ຄ່າຜິດຖືກຖິ້ມ ບໍ່ error
export const bookingFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  channel: z.enum(CHANNELS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type BookingFilters = z.infer<typeof bookingFiltersSchema>;

function searchWhere(q: string | undefined): Prisma.bookingsWhereInput {
  if (!q) return {};
  if (/^ks-?[a-z0-9]{1,5}$/i.test(q)) {
    const code = q.toUpperCase().replace(/^KS-?/, "KS-");
    return { booking_code: { startsWith: code } };
  }
  const phone = /^[+\d][\d\s\-().]{5,}$/.test(q) ? normalizePhone(q) : null;
  if (phone) return { customers: { phone } };
  return { customers: { full_name: { contains: q } } };
}

export async function listBookings(f: BookingFilters, showFullPhone: boolean) {
  const where: Prisma.bookingsWhereInput = {
    ...searchWhere(f.q),
    ...(f.status && { status: f.status }),
    ...(f.channel && { channel: f.channel }),
    ...((f.from || f.to) && {
      visit_date: { ...(f.from && { gte: isoDateToDb(f.from) }), ...(f.to && { lte: isoDateToDb(f.to) }) },
    }),
  };
  const [total, rows] = await Promise.all([
    prisma.bookings.count({ where }),
    prisma.bookings.findMany({
      where,
      orderBy: [{ visit_date: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        booking_code: true,
        visit_date: true,
        status: true,
        channel: true,
        total_amount: true,
        customers: { select: { full_name: true, phone: true } },
        booking_items: { select: { quantity: true } },
      },
    }),
  ]);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((b) => ({
      code: b.booking_code,
      visitDate: dbDateToIso(b.visit_date),
      status: b.status,
      channel: b.channel,
      total: b.total_amount.toFixed(2),
      people: b.booking_items.reduce((n, i) => n + i.quantity, 0),
      customerName: b.customers?.full_name ?? null,
      phone: showFullPhone ? (b.customers?.phone ?? null) : maskPhone(b.customers?.phone ?? null),
    })),
  };
}

// ລາຍລະອຽດ: ທຸກແຖວ payment (ຜູ້ກວດ · ເວລາ · ເຫດຜົນປະຕິເສດ) + ປະຫວັດສະແກນ — ບໍ່ມີ id_number (ຂໍ້ຕົກລົງ 5)
export async function getBookingDetail(code: string, showFullPhone: boolean) {
  const b = await prisma.bookings.findUnique({
    where: { booking_code: code },
    select: {
      booking_code: true,
      visit_date: true,
      status: true,
      channel: true,
      subtotal: true,
      discount: true,
      total_amount: true,
      created_at: true,
      users: { select: { full_name: true } },
      customers: { select: { full_name: true, phone: true, email: true, nationality: true } },
      booking_items: {
        select: { quantity: true, unit_price: true, line_total: true, ticket_types: { select: { name_lo: true, name_en: true, visitor_group: true, age_group: true } } },
      },
      booking_add_ons: { select: { quantity: true, line_total: true, add_ons: { select: { name_lo: true, name_en: true } } } },
      payments: {
        orderBy: { id: "asc" },
        select: {
          method: true,
          amount: true,
          status: true,
          paid_at: true,
          reject_reason: true,
          verified_at: true,
          refund_amount: true,
          refund_reason: true,
          created_at: true,
          users: { select: { full_name: true } },
        },
      },
      check_ins: {
        orderBy: { scanned_at: "asc" },
        select: { gate: true, scanned_at: true, result: true, note: true, users: { select: { full_name: true } } },
      },
    },
  });
  if (!b) return null;
  return {
    code: b.booking_code,
    visitDate: dbDateToIso(b.visit_date),
    status: b.status,
    channel: b.channel,
    subtotal: b.subtotal.toFixed(2),
    discount: b.discount.toFixed(2),
    total: b.total_amount.toFixed(2),
    createdAt: b.created_at.toISOString(),
    soldBy: b.users?.full_name ?? null,
    customer: b.customers
      ? {
          name: b.customers.full_name,
          phone: showFullPhone ? b.customers.phone : maskPhone(b.customers.phone),
          email: showFullPhone ? b.customers.email : null,
          nationality: b.customers.nationality,
        }
      : null,
    items: b.booking_items.map((i) => ({
      name: { lo: i.ticket_types.name_lo, en: i.ticket_types.name_en },
      quantity: i.quantity,
      unitPrice: i.unit_price.toFixed(2),
      lineTotal: i.line_total.toFixed(2),
    })),
    addOns: b.booking_add_ons.map((a) => ({ name: { lo: a.add_ons.name_lo, en: a.add_ons.name_en }, quantity: a.quantity, lineTotal: a.line_total.toFixed(2) })),
    payments: b.payments.map((p) => ({
      method: p.method,
      amount: p.amount.toFixed(2),
      status: p.status,
      paidAt: p.paid_at?.toISOString() ?? null,
      createdAt: p.created_at.toISOString(),
      verifiedBy: p.users?.full_name ?? null,
      verifiedAt: p.verified_at?.toISOString() ?? null,
      rejectReason: p.reject_reason,
      refundAmount: p.refund_amount?.toFixed(2) ?? null,
      refundReason: p.refund_reason,
    })),
    checkIns: b.check_ins.map((c) => ({
      gate: c.gate,
      scannedAt: c.scanned_at.toISOString(),
      result: c.result,
      offline: c.note?.startsWith("offline_sync:") ?? false,
      by: c.users?.full_name ?? null,
    })),
  };
}
