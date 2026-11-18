import { getAvailability } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { listProofQueue } from "@/lib/payments/proofs";
import type { GroupBy } from "@/lib/admin/report-range";
import { addDays, todayInVientiane } from "@/lib/time";

// ນິຍາມຕົວເລກ (ຜູ້ໃຊ້ອະນຸມັດ P10-1 / P10-2 / P10-3):
// - ລາຍໄດ້ = ການຈ່າຍທີ່ສຳເລັດ ນັບຕາມ "ວັນທີຮັບເງິນ" (payments.paid_at ເວລາລາວ) — ກົງກັບເງິນໃນລິ້ນຊັກ / ບັນຊີ
//   TODO(Phase 11): ການຄືນເງິນ — ດຽວນີ້ຫັກ refund_amount ອອກຈາກແຖວ refunded ໃນວັນຮັບເງິນເດີມ
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
const REVENUE = Prisma.sql`SUM(CASE p.status WHEN 'success' THEN p.amount ELSE p.amount - COALESCE(p.refund_amount, 0) END)`;
const COUNTED = Prisma.sql`p.status IN ('success','refunded') AND p.paid_at IS NOT NULL`;

const num = (v: Prisma.Decimal | number | bigint | null) => (v === null ? 0 : Number(v));

async function revenueBy(keySql: Prisma.Sql, start: Date, end: Date, join = Prisma.empty): Promise<Amount[]> {
  const rows = await prisma.$queryRaw<{ k: string; amount: Prisma.Decimal; n: bigint }[]>`
    SELECT ${keySql} AS k, ${REVENUE} AS amount, COUNT(*) AS n
    FROM payments p ${join}
    WHERE ${COUNTED} AND p.paid_at >= ${start} AND p.paid_at < ${end}
    GROUP BY k ORDER BY k`;
  return rows.map((r) => ({ key: String(r.k), amount: num(r.amount), count: num(r.n) }));
}

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
  const [byMethod, entered, booked, [day], proofs, duplicates] = await Promise.all([
    revenueBy(Prisma.sql`p.method`, start, end),
    enteredBy(Prisma.sql`'all'`, start, end),
    bookedBy(Prisma.sql`'all'`, today, today),
    getAvailability(prisma, today, today, now),
    listProofQueue(),
    offlineDuplicates(start, end),
  ]);
  return {
    date: today,
    revenue: byMethod.reduce((s, m) => s + m.amount, 0),
    revenueByMethod: byMethod as (Amount & { key: Method })[],
    enteredPeople: entered[0]?.people ?? 0,
    bookedPeople: booked[0]?.people ?? 0,
    left: day.left,
    closedToday: day.closedReason !== null && day.closedReason !== "after_hours",
    pendingProofs: proofs.length,
    offlineDuplicates: duplicates,
  };
}

export type ReportRange = { from: string; to: string; groupBy: GroupBy };

export async function getReport({ from, to, groupBy }: ReportRange) {
  const [start, end] = vientianeRange(from, to);
  const period = Prisma.sql`DATE_FORMAT(${LOCAL(Prisma.sql`p.paid_at`)}, ${PERIOD_FORMAT[groupBy]})`;
  const scanLocal = LOCAL(Prisma.sql`c.scanned_at`);
  const joinBooking = Prisma.sql`JOIN bookings b ON b.id = p.booking_id`;
  const [revenue, byChannel, byMethod, enteredByGroup, bookedByGroup, nationality, weekday, hour] = await Promise.all([
    revenueBy(period, start, end),
    revenueBy(Prisma.sql`b.channel`, start, end, joinBooking),
    revenueBy(Prisma.sql`p.method`, start, end),
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
    revenue,
    revenueTotal: sum(revenue, (r) => r.amount),
    byChannel: byChannel as (Amount & { key: Channel })[],
    byMethod: byMethod as (Amount & { key: Method })[],
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
