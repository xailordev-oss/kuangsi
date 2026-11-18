import { BusinessError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { expireStaleBookings, getAvailability, getPosWindow } from "@/lib/booking/availability";
import { generateBookingCode, generateQrToken } from "@/lib/booking/codes";
import { assertExpectedTotal, quote, type Quote } from "@/lib/booking/pricing";
import type { AddOnLineInput, TicketLineInput } from "@/lib/booking/schemas";
import { getBoolSetting, getIntSetting, type Db } from "@/lib/settings";
import { Prisma } from "@/lib/generated/prisma/client";
import { dayOfWeek, isoDateToDb, todayInVientiane } from "@/lib/time";

const LOCK_WAIT_SECONDS = 10;

// ກັນການຂາຍເກີນ (overbooking) + ກັນຂາຍຊ້ຳ (requestId): ການຈອງວັນດຽວກັນຕ້ອງເຂົ້າຄິວທີລະອັນ
// ລັອກແຖວ operating_hours ຂອງວັນໃນອາທິດນັ້ນ (FOR UPDATE) → ປ່ອຍຕອນ commit/rollback ເທົ່ານັ້ນ
// ດັ່ງນັ້ນອັນທີ່ລໍຄິວຈະເຫັນຂໍ້ມູນທີ່ອັນກ່ອນ commit ແລ້ວສະເໝີ
// (GET_LOCK ເດີມປ່ອຍກ່ອນ commit → 2 request ພ້ອມກັນ ອ່ານຂໍ້ມູນກ່ອນອີກອັນ commit ໄດ້)
async function withDateLock<T>(db: Db, date: string, fn: () => Promise<T>): Promise<T> {
  await db.$executeRawUnsafe(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_SECONDS}`);
  try {
    await db.$queryRaw`SELECT id FROM operating_hours WHERE day_of_week = ${dayOfWeek(date)} FOR UPDATE`;
  } catch (error) {
    if (String(error).includes("Lock wait timeout")) throw new BusinessError(503, "busy_try_again");
    throw error;
  }
  return fn();
}

async function assertBookable(db: Db, date: string, people: number): Promise<void> {
  const [day] = await getAvailability(db, date, date);
  if (day.closed) throw new BusinessError(422, "date_closed", { date, reason: day.closedReason });
  if (people > day.left) throw new BusinessError(409, "sold_out", { date, left: day.left });
}

async function uniqueBookingCode(db: Db): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateBookingCode();
    if (!(await db.bookings.findUnique({ where: { booking_code: code }, select: { id: true } }))) return code;
  }
  throw new Error("could not generate a unique booking code");
}

// ເບີໂທຊ້ຳ → ໃຊ້ record ເກົ່າ ບໍ່ສ້າງໃໝ່ (ຂໍ້ຕົກລົງ 4)
// ເຕີມສະເພາະຊ່ອງທີ່ຍັງວ່າງ (ອີເມວ, ສັນຊາດ, ເອກະສານ) — ບໍ່ທັບຊື່ ແລະ ຂໍ້ມູນທີ່ມີແລ້ວ (ຂໍ້ຕົກລົງ 25)
async function resolveCustomer(
  db: Db,
  c: { fullName?: string; phone?: string; email?: string; nationality?: string; idType?: "national_id" | "passport" | "other"; idNumber?: string },
): Promise<bigint | null> {
  if (c.phone) {
    const existing = await db.customers.findFirst({
      where: { phone: c.phone },
      orderBy: { id: "asc" },
      select: { id: true, email: true, nationality: true, id_type: true, id_number: true },
    });
    if (existing) {
      const fill = {
        ...(!existing.email && c.email && { email: c.email }),
        ...(!existing.nationality && c.nationality && { nationality: c.nationality }),
        ...(!existing.id_number && c.idNumber && c.idType && { id_type: c.idType, id_number: c.idNumber }),
      };
      if (Object.keys(fill).length) await db.customers.update({ where: { id: existing.id }, data: fill });
      return existing.id;
    }
  }
  if (!c.fullName) {
    if (c.phone) throw new BusinessError(422, "customer_name_required");
    return null;
  }
  const created = await db.customers.create({
    data: {
      full_name: c.fullName,
      phone: c.phone ?? null,
      email: c.email ?? null,
      nationality: c.nationality ?? null,
      id_type: c.idType ?? null,
      id_number: c.idNumber ?? null,
    },
    select: { id: true },
  });
  return created.id;
}

function lineCreates(q: Quote) {
  return {
    booking_items: {
      create: q.items.map((l) => ({ ticket_type_id: l.ticketTypeId, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal })),
    },
    booking_add_ons: {
      create: q.addOns.map((l) => ({ add_on_id: l.addOnId, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal })),
    },
  };
}

export type OnlineBookingInput = {
  visitDate: string;
  items: TicketLineInput[];
  addOns: AddOnLineInput[];
  customer: { fullName: string; phone: string; email?: string; nationality?: string; idType?: "national_id" | "passport" | "other"; idNumber?: string };
  expectedTotal: number;
};

// ຈອງ online: ໂອນເທົ່ານັ້ນ (ຂໍ້ຕົກລົງ 14) → status pending + ໂມງຕາມ settings.booking_hold_minutes (ຂໍ້ຕົກລົງ 9)
export async function createOnlineBooking(input: OnlineBookingInput) {
  return prisma.$transaction(
    (tx) =>
      withDateLock(tx, input.visitDate, async () => {
        await expireStaleBookings(tx, { visit_date: isoDateToDb(input.visitDate) });
        const q = await quote(tx, input.items, input.addOns);
        assertExpectedTotal(q, input.expectedTotal);
        if (q.total.lte(0)) throw new BusinessError(422, "nothing_to_pay");
        const maxPeople = await getIntSetting("max_people_per_booking", tx);
        if (q.people > maxPeople) throw new BusinessError(422, "too_many_people", { max: maxPeople });
        await assertBookable(tx, input.visitDate, q.people);

        const holdMinutes = await getIntSetting("booking_hold_minutes", tx);
        const customerId = await resolveCustomer(tx, input.customer);
        return tx.bookings.create({
          data: {
            booking_code: await uniqueBookingCode(tx),
            qr_token: generateQrToken(),
            customer_id: customerId,
            visit_date: isoDateToDb(input.visitDate),
            subtotal: q.subtotal,
            discount: q.discount,
            total_amount: q.total,
            currency: "LAK",
            status: "pending",
            channel: "online",
            expires_at: new Date(Date.now() + holdMinutes * 60_000),
            ...lineCreates(q),
          },
          select: { booking_code: true },
        });
      }),
    { timeout: 20_000, maxWait: 10_000 },
  );
}

export type GateSaleInput = {
  items: TicketLineInput[];
  addOns: AddOnLineInput[];
  customer?: { fullName?: string; phone?: string };
  cashReceived: number;
  expectedTotal: number;
  staffId: bigint;
  requestId?: string;
};

export type GateSaleResult = { bookingCode: string; total: Prisma.Decimal; change: Prisma.Decimal; checkedIn: boolean; replayed: boolean };

// ການຂາຍທີ່ເຄີຍສຳເລັດດ້ວຍ requestId ນີ້ (ພາຍໃນ 1 ວັນ) — ເກັບໄວ້ໃນ audit_logs.new_value
async function priorGateSale(db: Db, requestId: string): Promise<GateSaleResult | null> {
  const rows = await db.$queryRaw<{ code: string; total: string; cash: string; checked: number | bigint | boolean }[]>`
    SELECT JSON_UNQUOTE(JSON_EXTRACT(new_value, '$.bookingCode')) AS code,
           JSON_UNQUOTE(JSON_EXTRACT(new_value, '$.total')) AS total,
           JSON_UNQUOTE(JSON_EXTRACT(new_value, '$.cashReceived')) AS cash,
           JSON_EXTRACT(new_value, '$.autoCheckin') = true AS checked
    FROM audit_logs
    WHERE action = 'booking.gate_sale' AND created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY
      AND JSON_UNQUOTE(JSON_EXTRACT(new_value, '$.requestId')) = ${requestId}
    LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  const total = new Prisma.Decimal(r.total);
  return { bookingCode: r.code, total, change: new Prisma.Decimal(r.cash).sub(total), checkedIn: Boolean(Number(r.checked)), replayed: true };
}

// ຂາຍໜ້າປະຕູ: ມື້ນີ້ · ເງິນສົດ · paid ທັນທີ · ລູກຄ້າບໍ່ບັງຄັບ (ຂໍ້ຕົກລົງ 16, 17)
export async function createGateSale(input: GateSaleInput): Promise<GateSaleResult> {
  const visitDate = todayInVientiane();
  return prisma.$transaction(
    (tx) =>
      withDateLock(tx, visitDate, async () => {
        // ກວດພາຍໃນ lock ລາຍວັນ → request ຊ້ຳທີ່ມາພ້ອມກັນເຂົ້າຄິວ ແລະ ເຫັນອັນທຳອິດທີ່ commit ແລ້ວ
        if (input.requestId) {
          const prior = await priorGateSale(tx, input.requestId);
          if (prior) return prior;
        }
        await expireStaleBookings(tx, { visit_date: isoDateToDb(visitDate) });
        const q = await quote(tx, input.items, input.addOns);
        assertExpectedTotal(q, input.expectedTotal);
        if (q.total.gt(input.cashReceived)) {
          throw new BusinessError(422, "insufficient_cash", { total: q.total.toFixed(2), short: q.total.sub(input.cashReceived).toFixed(2) });
        }
        const window = await getPosWindow(tx);
        if (window.state === "closed") throw new BusinessError(422, "date_closed", { date: visitDate, reason: window.closedReason });
        if (q.people > window.left) throw new BusinessError(409, "sold_out", { date: visitDate, left: window.left });

        const autoCheckin = await getBoolSetting("pos_auto_checkin", tx);
        const customerId = input.customer ? await resolveCustomer(tx, input.customer) : null;
        const now = new Date();
        const booking = await tx.bookings.create({
          data: {
            booking_code: await uniqueBookingCode(tx),
            qr_token: generateQrToken(),
            customer_id: customerId,
            visit_date: isoDateToDb(visitDate),
            subtotal: q.subtotal,
            discount: q.discount,
            total_amount: q.total,
            currency: "LAK",
            status: autoCheckin ? "used" : "paid",
            channel: "gate",
            created_by: input.staffId,
            ...lineCreates(q),
            ...(q.total.gt(0) && {
              payments: {
                create: {
                  method: "cash",
                  amount: q.total,
                  currency: "LAK",
                  status: "success",
                  paid_at: now,
                  verified_by: input.staffId,
                  verified_at: now,
                },
              },
            }),
            ...(autoCheckin && {
              check_ins: { create: { result: "ok", scanned_by: input.staffId, scanned_at: now, note: "pos_auto_checkin" } },
            }),
          },
          select: { id: true, booking_code: true },
        });

        await tx.audit_logs.create({
          data: {
            user_id: input.staffId,
            action: "booking.gate_sale",
            table_name: "bookings",
            record_id: booking.id,
            new_value: {
              bookingCode: booking.booking_code,
              total: q.total.toFixed(2),
              cashReceived: String(input.cashReceived),
              people: q.people,
              autoCheckin,
              requestId: input.requestId ?? null,
            },
          },
        });

        return {
          bookingCode: booking.booking_code,
          total: q.total,
          change: q.total.neg().add(input.cashReceived),
          checkedIn: autoCheckin,
          replayed: false,
        };
      }),
    { timeout: 20_000, maxWait: 10_000 },
  );
}
