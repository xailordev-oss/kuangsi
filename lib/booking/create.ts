import { BusinessError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getAvailability, expireStaleBookings } from "@/lib/booking/availability";
import { generateBookingCode, generateQrToken } from "@/lib/booking/codes";
import { quote, type Quote } from "@/lib/booking/pricing";
import type { AddOnLineInput, TicketLineInput } from "@/lib/booking/schemas";
import { getBoolSetting, getIntSetting, type Db } from "@/lib/settings";
import { isoDateToDb, todayInVientiane } from "@/lib/time";

const LOCK_WAIT_SECONDS = 10;

// ກັນການຂາຍເກີນ (overbooking): ການຈອງວັນດຽວກັນຕ້ອງເຂົ້າຄິວທີລະອັນ
// GET_LOCK ຜູກກັບ connection — interactive transaction ຂອງ Prisma ໃຊ້ connection ດຽວຕະຫຼອດ
async function withDateLock<T>(db: Db, date: string, fn: () => Promise<T>): Promise<T> {
  const name = `kuangsi:capacity:${date}`;
  const [{ got }] = await db.$queryRaw<{ got: bigint | number | null }[]>`SELECT GET_LOCK(${name}, ${LOCK_WAIT_SECONDS}) AS got`;
  if (Number(got) !== 1) throw new BusinessError(503, "busy_try_again");
  try {
    return await fn();
  } finally {
    await db.$queryRaw`SELECT RELEASE_LOCK(${name})`;
  }
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
};

// ຈອງ online: ໂອນເທົ່ານັ້ນ (ຂໍ້ຕົກລົງ 14) → status pending + ໂມງຕາມ settings.booking_hold_minutes (ຂໍ້ຕົກລົງ 9)
export async function createOnlineBooking(input: OnlineBookingInput) {
  return prisma.$transaction(
    (tx) =>
      withDateLock(tx, input.visitDate, async () => {
        await expireStaleBookings(tx, { visit_date: isoDateToDb(input.visitDate) });
        const q = await quote(tx, input.items, input.addOns);
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
  staffId: bigint;
};

// ຂາຍໜ້າປະຕູ: ມື້ນີ້ · ເງິນສົດ · paid ທັນທີ · ລູກຄ້າບໍ່ບັງຄັບ (ຂໍ້ຕົກລົງ 16, 17)
export async function createGateSale(input: GateSaleInput) {
  const visitDate = todayInVientiane();
  return prisma.$transaction(
    (tx) =>
      withDateLock(tx, visitDate, async () => {
        await expireStaleBookings(tx, { visit_date: isoDateToDb(visitDate) });
        const q = await quote(tx, input.items, input.addOns);
        if (q.total.gt(input.cashReceived)) {
          throw new BusinessError(422, "insufficient_cash", { total: q.total.toFixed(2), short: q.total.sub(input.cashReceived).toFixed(2) });
        }
        await assertBookable(tx, visitDate, q.people);

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
            new_value: { bookingCode: booking.booking_code, total: q.total.toFixed(2), people: q.people, autoCheckin },
          },
        });

        return {
          bookingCode: booking.booking_code,
          total: q.total,
          change: q.total.neg().add(input.cashReceived),
          checkedIn: autoCheckin,
        };
      }),
    { timeout: 20_000, maxWait: 10_000 },
  );
}
