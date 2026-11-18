import { getAvailability } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { listProofQueue } from "@/lib/payments/proofs";
import type { GroupBy } from "@/lib/admin/report-range";
import { addDays, todayInVientiane } from "@/lib/time";

// ນິຍາມຕົວເລກ (ຜູ້ໃຊ້ອະນຸມັດ P10-1 / P10-2 / P10-3):
// - ລາຍໄດ້ແບບເງິນເຂົ້າ-ອອກ (ຂໍ້ຕົກລົງ 44) — ກົງກັບເງິນໃນລິ້ນຊັກ / ບັນຊີ:
//   ຮັບເງິນ = ຍອດເຕັມຂອງການຈ່າຍທີ່ສຳເລັດ (ລວມອັນທີ່ພາຍຫຼັງຖືກຄືນ) ນັບຕາມ paid_at
//   ຄືນເງິນ = refund_amount ນັບຕາມ refunded_at (ບໍ່ຫັກຍ້ອນຫຼັງ → ລາຍງານຂອງວັນທີ່ຜ່ານໄປບໍ່ປ່ຽນ)
//   ສຸດທິ = ຮັບ − ຄືນ · ສະແດງທັງ 3 ຕົວເລກສະເໝີ
// - ເຂົ້າແລ້ວ = ຄົນໃນການຈອງທີ່ສະແກນຜ່ານ (check_ins ok) ນັບຕາມວັນທີສະແກນ
// - ຈອງແລ້ວ = ຄົນໃນການຈອງ paid / used ນັບຕາມວັນເຂົ້າຊົມ
// - ລາວ/ຕ່າງປະເທດ ມາຈາກປະເພດປີ້ (ມີທຸກການຈອງ) · ສັນຊາດມາຈາກລູກຄ້າ (POS ສ່ວນໃຫຍ່ "ບໍ່ລະບຸ")

export type Method = "bank_transfer" | "bcel_one" | "ldb" | "onepay" | "card" | "cash" | "other";
export type Channel = "online" | "gate" | "tour_agency";
export type Amount = { key: string; amount: number; count: number };
export type People = { key: string; people: number };

// ວັນທີລາວ (YYYY-MM-DD) → ຊ່ວງ UTC [ເລີ່ມ, ຈົບ) — DB ເກັບ UTC (CLAUDE.md ພາກ 6)
export function vientianeRange(from: string, to: string): [Date, Date] {
  return [new Date(`${from}T00:00:00+07:00`), new Date(`${addDays(to, 1)}T00:00:00+07:00`)];
}

const LOCAL = (col: Prisma.Sql) => Prisma.sql`CONVERT_TZ(${col}, '+00:00', '+07:00')`;
const PERIOD_FORMAT: Record<GroupBy, string> = { day: "%Y-%m-%d", month: "%Y-%m", year: "%Y" };
const RECEIVED = Prisma.sql`p.status IN ('success','refunded') AND p.paid_at IS NOT NULL`;

const num = (v: Prisma.Decimal | number | bigint | null) => (v === null ? 0 : Number(v));

async function receivedBy(keySql: Prisma.Sql, start: Date, end: Date, join = Prisma.empty): Promise<Amount[]> {
  const rows = await prisma.$queryRaw<{ k: string; amount: Prisma.Decimal; n: bigint }[]>`
    SELECT ${keySql} AS k, SUM(p.amount) AS amount, COUNT(*) AS n
    FROM payments p ${join}
    WHERE ${RECEIVED} AND p.paid_at >= ${start} AND p.paid_at < ${end}
    GROUP BY k ORDER BY k`;
  return rows.map((r) => ({ key: String(r.k), amount: num(r.amount), count: num(r.n) }));
}

// ຄືນເງິນ — ນັບຕາມວັນທີຄືນເງິນ (keySql ຕ້ອງອ້າງ p.refunded_at ບໍ່ແມ່ນ p.paid_at)
async function refundedBy(keySql: Prisma.Sql, start: Date, end: Date): Promise<Amount[]> {
  const rows = await prisma.$queryRaw<{ k: string; amount: Prisma.Decimal; n: bigint }[]>`
    SELECT ${keySql} AS k, SUM(p.refund_amount) AS amount, COUNT(*) AS n
    FROM payments p
    WHERE p.refund_amount IS NOT NULL AND p.refunded_at >= ${start} AND p.refunded_at < ${end}
    GROUP BY k ORDER BY k`;
  return rows.map((r) => ({ key: String(r.k), amount: num(r.amount), count: num(r.n) }));
}

export type CashFlow = { key: string; received: number; refunded: number; net: number };

function mergeFlows(received: Amount[], refunded: Amount[]): CashFlow[] {
  const keys = [...new Set([...received.map((r) => r.key), ...refunded.map((r) => r.key)])].sort();
  return keys.map((key) => {
    const rec = received.find((r) => r.key === key)?.amount ?? 0;
    const ref = refunded.find((r) => r.key === key)?.amount ?? 0;
    return { key, received: rec, refunded: ref, net: rec - ref };
  });
}

const totalFlow = (rows: CashFlow[]) =>
  rows.reduce((t, r) => ({ received: t.received + r.received, refunded: t.refunded + r.refunded, net: t.net + r.net }), { received: 0, refunded: 0, net: 0 });

async function enteredBy(keySql: Prisma.Sql, start: Date, end: Date): Promise<People[]> {
  const rows = await prisma.$queryRaw<{ k: string | number; people: Prisma.Decimal | null }[]>`
    SELECT ${keySql} AS k, SUM(bi.quantity) AS people
    FROM check_ins c
    JOIN booking_items bi ON bi.booking_id = c.booking_id
    JOIN ticket_types tt ON tt.id = bi.ticket_type_id
    WHERE c.result = 'ok' AND c.scanned_at >= ${start} AND c.scanned_at < ${end}
    GROUP BY k ORDER BY k`;
  return rows.map((r) => ({ key: String(r.k), people: num(r.people) }));
}

async function bookedBy(keySql: Prisma.Sql, from: string, to: string, join = Prisma.empty): Promise<People[]> {
  const rows = await prisma.$queryRaw<{ k: string | null; people: Prisma.Decimal | null }[]>`
    SELECT ${keySql} AS k, SUM(bi.quantity) AS people
    FROM bookings b
    JOIN booking_items bi ON bi.booking_id = b.id
    JOIN ticket_types tt ON tt.id = bi.ticket_type_id
    ${join}
    WHERE b.status IN ('paid','used') AND b.visit_date BETWEEN ${from} AND ${to}
    GROUP BY k ORDER BY people DESC`;
  return rows.map((r) => ({ key: r.k ?? "", people: num(r.people) }));
}

const offlineDuplicates = (start: Date, end: Date) =>
  prisma.check_ins.count({ where: { result: "duplicate", note: { startsWith: "offline_sync:" }, scanned_at: { gte: start, lt: end } } });

export async function getDashboard(now = new Date()) {
  const today = todayInVientiane(now);
  const [start, end] = vientianeRange(today, today);
  const [byMethod, refundByMethod, entered, booked, [day], proofs, duplicates] = await Promise.all([
    receivedBy(Prisma.sql`p.method`, start, end),
    refundedBy(Prisma.sql`p.method`, start, end),
    enteredBy(Prisma.sql`'all'`, start, end),
    bookedBy(Prisma.sql`'all'`, today, today),
    getAvailability(prisma, today, today, now),
    listProofQueue(),
    offlineDuplicates(start, end),
  ]);
  return {
    date: today,
    money: totalFlow(mergeFlows(byMethod, refundByMethod)),
    byMethod: mergeFlows(byMethod, refundByMethod) as (CashFlow & { key: Method })[],
    enteredPeople: entered[0]?.people ?? 0,
    bookedPeople: booked[0]?.people ?? 0,
    left: day.left,
    closedToday: day.closedReason !== null && day.closedReason !== "after_hours",
    pendingProofs: proofs.length,
    offlineDuplicates: duplicates,
  };
}

async function refundedByChannel(start: Date, end: Date): Promise<Amount[]> {
  const rows = await prisma.$queryRaw<{ k: string; amount: Prisma.Decimal; n: bigint }[]>`
    SELECT b.channel AS k, SUM(p.refund_amount) AS amount, COUNT(*) AS n
    FROM payments p JOIN bookings b ON b.id = p.booking_id
    WHERE p.refund_amount IS NOT NULL AND p.refunded_at >= ${start} AND p.refunded_at < ${end}
    GROUP BY k ORDER BY k`;
  return rows.map((r) => ({ key: String(r.k), amount: num(r.amount), count: num(r.n) }));
}

export type ReportRange = { from: string; to: string; groupBy: GroupBy };

export async function getReport({ from, to, groupBy }: ReportRange) {
  const [start, end] = vientianeRange(from, to);
  const period = (col: Prisma.Sql) => Prisma.sql`DATE_FORMAT(${LOCAL(col)}, ${PERIOD_FORMAT[groupBy]})`;
  const scanLocal = LOCAL(Prisma.sql`c.scanned_at`);
  const joinBooking = Prisma.sql`JOIN bookings b ON b.id = p.booking_id`;
  const [received, refunded, recChannel, refChannel, recMethod, refMethod, enteredByGroup, bookedByGroup, nationality, weekday, hour] = await Promise.all([
    receivedBy(period(Prisma.sql`p.paid_at`), start, end),
    refundedBy(period(Prisma.sql`p.refunded_at`), start, end),
    receivedBy(Prisma.sql`b.channel`, start, end, joinBooking),
    refundedByChannel(start, end),
    receivedBy(Prisma.sql`p.method`, start, end),
    refundedBy(Prisma.sql`p.method`, start, end),
    enteredBy(Prisma.sql`CONCAT(tt.visitor_group, ':', tt.age_group)`, start, end),
    bookedBy(Prisma.sql`CONCAT(tt.visitor_group, ':', tt.age_group)`, from, to),
    bookedBy(Prisma.sql`cu.nationality`, from, to, Prisma.sql`LEFT JOIN customers cu ON cu.id = b.customer_id`),
    // ລະດູ / ຊ່ວງເວລາທີ່ຄົນມາຫຼາຍ (requirements 2.7): 0 = ອາທິດ … 6 = ເສົາ
    enteredBy(Prisma.sql`DAYOFWEEK(${scanLocal}) - 1`, start, end),
    enteredBy(Prisma.sql`HOUR(${scanLocal})`, start, end),
  ]);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    from,
    to,
    groupBy,
    revenue: mergeFlows(received, refunded),
    money: totalFlow(mergeFlows(received, refunded)),
    byChannel: mergeFlows(recChannel, refChannel) as (CashFlow & { key: Channel })[],
    byMethod: mergeFlows(recMethod, refMethod) as (CashFlow & { key: Method })[],
    enteredByGroup,
    enteredTotal: sum(enteredByGroup, (r) => r.people),
    bookedByGroup,
    bookedTotal: sum(bookedByGroup, (r) => r.people),
    nationality,
    weekday: weekday.map((r) => ({ ...r, key: Number(r.key) })),
    hour: hour.map((r) => ({ ...r, key: Number(r.key) })),
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;

// ຂໍ້ຕົກລົງ 39: ປີ້ທີ່ຖືກປ່ອຍເຂົ້າຕອນ offline ແຕ່ຕອນ sync ພົບວ່າຜ່ານໄປແລ້ວ — ອ່ານຢ່າງດຽວ (P10-6)
export async function listOfflineDuplicates(from: string, to: string) {
  const [start, end] = vientianeRange(from, to);
  const rows = await prisma.check_ins.findMany({
    where: { result: "duplicate", note: { startsWith: "offline_sync:" }, scanned_at: { gte: start, lt: end } },
    orderBy: { scanned_at: "desc" },
    take: 500,
    select: {
      id: true,
      gate: true,
      scanned_at: true,
      users: { select: { full_name: true } },
      bookings: {
        select: {
          booking_code: true,
          booking_items: { select: { quantity: true, ticket_types: { select: { visitor_group: true, age_group: true } } } },
          check_ins: { where: { result: "ok" }, select: { gate: true, scanned_at: true, users: { select: { full_name: true } } }, take: 1 },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: String(r.id),
    bookingCode: r.bookings.booking_code,
    gate: r.gate,
    scannedAt: r.scanned_at.toISOString(),
    scannedBy: r.users?.full_name ?? null,
    lines: r.bookings.booking_items.map((i) => ({ visitorGroup: i.ticket_types.visitor_group, ageGroup: i.ticket_types.age_group, quantity: i.quantity })),
    first: r.bookings.check_ins[0]
      ? { gate: r.bookings.check_ins[0].gate, scannedAt: r.bookings.check_ins[0].scanned_at.toISOString(), by: r.bookings.check_ins[0].users?.full_name ?? null }
      : null,
  }));
}
