import { Prisma } from "@/lib/generated/prisma/client";
import { getIntSetting, type Db } from "@/lib/settings";
import { addDays, daysBetween, dayOfWeek, dbDateToIso, dbTimeToString, isoDateToDb, timeNowInVientiane, todayInVientiane } from "@/lib/time";

// beyond_booking_window = ເກີນ settings.max_advance_days (ຈອງ online ບໍ່ໄດ້ — ຂໍ້ຕົກລົງ 26)
export type ClosedReason = "past" | "beyond_booking_window" | "holiday" | "weekly_closed" | "after_hours";

export type DayAvailability = {
  date: string;
  closed: boolean;
  closedReason: ClosedReason | null;
  openTime: string | null;
  closeTime: string | null;
  capacity: number;
  booked: number;
  left: number;
};

// POS ຂາຍໄດ້ສະເພາະມື້ນີ້: ເປີດ → open · settings.pos_grace_minutes ກ່ອນເປີດ ແລະ ຫຼັງປິດ → grace (ຂາຍໄດ້ + ແຖບເຕືອນ)
// ເຊົ້າ: ນັກທ່ອງທ່ຽວມາລໍກ່ອນເປີດ · ແລງ: ຄົນທີ່ຍັງຕໍ່ຄິວຕອນປິດ
export type PosWindow = {
  date: string;
  state: "open" | "grace" | "closed";
  // before_hours: ຍັງບໍ່ຮອດເວລາເປີດ (ສະເພາະ POS — ຈອງ online ສຳລັບມື້ນີ້ຍັງໄດ້)
  closedReason: ClosedReason | "before_hours" | null;
  openTime: string | null;
  closeTime: string | null;
  graceFrom: string | null;
  graceUntil: string | null;
  left: number;
};

function addMinutesToTime(hhmmss: string, minutes: number): string {
  const [h, m, s] = hhmmss.split(":").map(Number);
  const total = Math.max(0, Math.min(h * 3600 + m * 60 + s + minutes * 60, 24 * 3600 - 1));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

export async function getPosWindow(db: Db, now = new Date()): Promise<PosWindow> {
  const today = todayInVientiane(now);
  const [[day], grace] = await Promise.all([getAvailability(db, today, today, now), getIntSetting("pos_grace_minutes", db)]);
  const graceFrom = day.openTime ? addMinutesToTime(day.openTime, -grace) : null;
  const graceUntil = day.closeTime ? addMinutesToTime(day.closeTime, grace) : null;
  const timeNow = timeNowInVientiane(now);
  const early = day.closedReason === null && day.openTime !== null && timeNow < day.openTime;
  const beforeHours = early && graceFrom !== null && timeNow < graceFrom;
  const lateGrace = day.closedReason === "after_hours" && graceUntil !== null && timeNow < graceUntil;
  const state = beforeHours ? "closed" : early || lateGrace ? "grace" : day.closedReason === null ? "open" : "closed";
  return {
    date: today,
    state,
    closedReason: state !== "closed" ? null : beforeHours ? "before_hours" : day.closedReason,
    openTime: day.openTime,
    closeTime: day.closeTime,
    graceFrom,
    graceUntil,
    left: state === "closed" ? 0 : Math.max(0, day.capacity - day.booked),
  };
}

// ການຈອງທີ່ກິນບ່ອນ: pending ທີ່ຍັງບໍ່ໝົດເວລາ, verifying (ໂມງຢຸດ — ຂໍ້ຕົກລົງ 15), paid, used
const HOLDS_CAPACITY = Prisma.sql`(b.status IN ('verifying','paid','used') OR (b.status = 'pending' AND b.expires_at > UTC_TIMESTAMP()))`;

export async function expireStaleBookings(db: Db, where: Prisma.bookingsWhereInput = {}): Promise<number> {
  const { count } = await db.bookings.updateMany({
    where: { ...where, status: "pending", expires_at: { lt: new Date() } },
    data: { status: "expired" },
  });
  return count;
}

// ນັບຄົນ (ລວມເດັກນ້ອຍຟຣີ) ເພາະ capacity ແມ່ນຈຳນວນຄົນໃນພື້ນທີ່
async function bookedPeopleByDate(db: Db, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ d: Date; people: Prisma.Decimal | number | bigint }[]>`
    SELECT b.visit_date AS d, COALESCE(SUM(bi.quantity), 0) AS people
    FROM bookings b JOIN booking_items bi ON bi.booking_id = b.id
    WHERE b.visit_date BETWEEN ${from} AND ${to} AND ${HOLDS_CAPACITY}
    GROUP BY b.visit_date`;
  return new Map(rows.map((r) => [dbDateToIso(r.d), Number(r.people)]));
}

export async function getAvailability(db: Db, from: string, to: string, now = new Date()): Promise<DayAvailability[]> {
  const [defaultCapacity, maxAdvanceDays, hours, holidays, overrides, booked] = await Promise.all([
    getIntSetting("max_visitors_per_day", db),
    getIntSetting("max_advance_days", db),
    db.operating_hours.findMany(),
    db.holidays.findMany({ where: { holiday_date: { gte: isoDateToDb(from), lte: isoDateToDb(to) } } }),
    db.daily_capacity.findMany({
      where: { capacity_date: { gte: isoDateToDb(from), lte: isoDateToDb(to) }, time_slot_id: null },
    }),
    bookedPeopleByDate(db, from, to),
  ]);

  const hoursByDow = new Map(hours.map((h) => [h.day_of_week, h]));
  const holidayByDate = new Map(holidays.map((h) => [dbDateToIso(h.holiday_date), h]));
  const overrideByDate = new Map(overrides.map((o) => [dbDateToIso(o.capacity_date), o.max_visitors]));
  const today = todayInVientiane(now);
  const timeNow = timeNowInVientiane(now);
  const lastBookableDate = addDays(today, maxAdvanceDays);

  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => {
    const date = addDays(from, i);
    const opening = hoursByDow.get(dayOfWeek(date));
    const openTime = opening ? dbTimeToString(opening.open_time) : null;
    const closeTime = opening ? dbTimeToString(opening.close_time) : null;

    let closedReason: ClosedReason | null = null;
    if (date < today) closedReason = "past";
    else if (date > lastBookableDate) closedReason = "beyond_booking_window";
    else if (holidayByDate.get(date)?.is_closed) closedReason = "holiday";
    else if (!opening || opening.is_closed) closedReason = "weekly_closed";
    else if (date === today && closeTime !== null && timeNow >= closeTime) closedReason = "after_hours";

    const capacity = overrideByDate.get(date) ?? defaultCapacity;
    const people = booked.get(date) ?? 0;
    return {
      date,
      closed: closedReason !== null,
      closedReason,
      openTime,
      closeTime,
      capacity,
      booked: people,
      left: closedReason ? 0 : Math.max(0, capacity - people),
    };
  });
}
