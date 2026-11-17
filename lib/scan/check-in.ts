import { BusinessError } from "@/lib/api";
import { expireStaleBookings } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getGates } from "@/lib/settings";
import { dbDateToIso, isoDateToDb, todayInVientiane } from "@/lib/time";

export type ScanResult = "ok" | "duplicate" | "wrong_date" | "expired" | "invalid" | "unpaid" | "cancelled";

// ຂໍ້ຕົກລົງ 23: ສະແດງປະເພດປີ້ ແຍກ ກຸ່ມ × ອາຍຸ ໃຫ້ພະນັກງານກວດບັດໄດ້
export type TicketLine = { visitorGroup: "lao" | "foreigner"; ageGroup: "adult" | "child" | "senior" | "free"; quantity: number };

export type ScanOutcome = {
  result: ScanResult;
  bookingCode: string | null;
  visitDate: string | null;
  lines: TicketLine[];
  previous: { scannedAt: string; gate: string } | null;
};

const OFFLINE_NOTE = "offline_sync";

const bookingInclude = {
  booking_items: { select: { quantity: true, ticket_types: { select: { visitor_group: true, age_group: true } } } },
  check_ins: { where: { result: "ok" }, select: { scanned_at: true, gate: true }, take: 1 },
} satisfies Prisma.bookingsInclude;

type BookingForScan = Prisma.bookingsGetPayload<{ include: typeof bookingInclude }>;

export function linesOf(items: BookingForScan["booking_items"]): TicketLine[] {
  const merged = new Map<string, TicketLine>();
  for (const i of items) {
    const key = `${i.ticket_types.visitor_group}:${i.ticket_types.age_group}`;
    const line = merged.get(key) ?? { visitorGroup: i.ticket_types.visitor_group, ageGroup: i.ticket_types.age_group, quantity: 0 };
    line.quantity += i.quantity;
    merged.set(key, line);
  }
  return [...merged.values()];
}

export async function assertGate(gate: string): Promise<void> {
  if (!(await getGates()).includes(gate)) throw new BusinessError(422, "unknown_gate", { gate });
}

function decide(b: BookingForScan, today: string): ScanResult {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "expired") return "expired";
  if (b.status === "pending" || b.status === "verifying") return "unpaid";
  if (dbDateToIso(b.visit_date) !== today) return "wrong_date";
  if (b.status === "used" || b.check_ins.length > 0) return "duplicate";
  return "ok";
}

function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

// ຜ່ານປະຕູ: ລັອກແຖວການຈອງກ່ອນ ເພື່ອໃຫ້ 2 ປະຕູທີ່ສະແກນພ້ອມກັນເຂົ້າຄິວ (ບໍ່ດັ່ງນັ້ນ InnoDB deadlock → 500)
// unique ok_booking_id ຍັງເປັນຕາໜ່າງສຸດທ້າຍ (P2002) · deadlock ທີ່ຍັງເກີດໄດ້ (P2034) → ລອງໃໝ່ 1 ຄັ້ງ
async function admit(bookingId: bigint, data: { gate: string; staffId: bigint; scannedAt: Date; note: string | null }): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
        if (await tx.check_ins.findFirst({ where: { booking_id: bookingId, result: "ok" }, select: { id: true } })) return false;
        await tx.check_ins.create({
          data: { booking_id: bookingId, gate: data.gate, scanned_by: data.staffId, scanned_at: data.scannedAt, result: "ok", note: data.note },
        });
        await tx.bookings.update({ where: { id: bookingId }, data: { status: "used" } });
        return true;
      });
    } catch (error) {
      const code = prismaCode(error);
      if (code === "P2002") return false;
      if (code === "P2034" && attempt === 0) continue;
      throw error;
    }
  }
}

// ກວດປີ້ 1 ໃບ ແລະ ບັນທຶກ check_ins ທຸກຄັ້ງ (ລວມທັງການປະຕິເສດ — ຂໍ້ຕົກລົງ 18)
// ຜ່ານໄດ້ຄັ້ງດຽວ: unique ok_booking_id ໃນ DB ເປັນຜູ້ຕັດສິນສຸດທ້າຍ ເຖິງສະແກນພ້ອມກັນ 2 ປະຕູ
export async function scanTicket(input: {
  qrToken?: string;
  bookingCode?: string;
  gate: string;
  staffId: bigint;
  scannedAt?: Date;
  offlineId?: string;
}): Promise<ScanOutcome> {
  const where = input.qrToken ? { qr_token: input.qrToken } : input.bookingCode ? { booking_code: input.bookingCode } : null;
  if (!where) return { result: "invalid", bookingCode: null, visitDate: null, lines: [], previous: null };

  await expireStaleBookings(prisma, where);
  const booking = await prisma.bookings.findUnique({ where, include: bookingInclude });
  // ບໍ່ພົບການຈອງ → ບັນທຶກບໍ່ໄດ້ (check_ins.booking_id ເປັນ NOT NULL)
  if (!booking) return { result: "invalid", bookingCode: null, visitDate: null, lines: [], previous: null };

  const scannedAt = input.scannedAt ?? new Date();
  const note = input.offlineId ? `${OFFLINE_NOTE}:${input.offlineId}` : null;
  let result = decide(booking, todayInVientiane(scannedAt));

  if (result === "ok" && !(await admit(booking.id, { gate: input.gate, staffId: input.staffId, scannedAt, note }))) {
    result = "duplicate"; // ອີກປະຕູ ຫຼື ອີກເຄື່ອງ ຜ່ານກ່ອນແລ້ວ
  }
  if (result !== "ok") {
    await prisma.check_ins.create({ data: { booking_id: booking.id, gate: input.gate, scanned_by: input.staffId, scanned_at: scannedAt, result, note } });
  }

  const previous =
    result === "duplicate"
      ? await prisma.check_ins.findFirst({ where: { booking_id: booking.id, result: "ok" }, select: { scanned_at: true, gate: true } })
      : null;

  return {
    result,
    bookingCode: booking.booking_code,
    visitDate: dbDateToIso(booking.visit_date),
    lines: linesOf(booking.booking_items),
    previous: previous ? { scannedAt: previous.scanned_at.toISOString(), gate: previous.gate } : null,
  };
}

// ລາຍການປີ້ຂອງມື້ນີ້ ສຳລັບກວດຕອນ offline — ບໍ່ມີຂໍ້ມູນສ່ວນຕົວ (ຊື່/ເບີ/ເລກບັດ)
export async function scanManifest() {
  const today = todayInVientiane();
  await expireStaleBookings(prisma, { visit_date: isoDateToDb(today) });
  const bookings = await prisma.bookings.findMany({ where: { visit_date: isoDateToDb(today) }, include: bookingInclude });
  return {
    date: today,
    generatedAt: new Date().toISOString(),
    gates: await getGates(),
    tickets: bookings.map((b) => ({
      qrToken: b.qr_token,
      bookingCode: b.booking_code,
      status: b.status,
      checkedIn: b.check_ins.length > 0,
      lines: linesOf(b.booking_items),
    })),
  };
}

// ເວລາສະແກນ offline ມາຈາກເຄື່ອງພະນັກງານ — ຮັບສະເພາະ 48 ຊມ ທີ່ຜ່ານມາ (ບໍ່ຮັບອະນາຄົດ)
export function trustedScanTime(iso: string, now = Date.now()): Date {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= now + 5 * 60_000 && t >= now - 48 * 3_600_000 ? new Date(t) : new Date(now);
}

// sync ຊ້ຳໄດ້ (ເນັດຂາດກາງທາງ) ໂດຍບໍ່ບັນທຶກຊ້ຳ — ຈື່ offlineId ໄວ້ໃນ check_ins.note
export async function alreadySynced(offlineId: string) {
  return prisma.check_ins.findFirst({
    where: { note: `${OFFLINE_NOTE}:${offlineId}` },
    select: { result: true, bookings: { select: { booking_code: true } } },
  });
}
