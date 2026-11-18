import { z } from "zod";
import { writeAudit, type Actor } from "@/lib/admin/audit";
import { BusinessError } from "@/lib/api";
import { bookingLoadByDate } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { GATE_NAME, INT_SETTINGS, isConfigured, NOTE_LOCALES, type Db, type IntSettingKey } from "@/lib/settings";
import { addDays, dayOfWeek, dbDateToIso, dbTimeToString, isoDateToDb, isValidIsoDate, todayInVientiane } from "@/lib/time";

// ===== ຜົນກະທົບ (ເຕືອນ ບໍ່ຫ້າມ) — server ຄຳນວນ ແລ້ວ UI ສະແດງໃນ Dialog ຢືນຢັນ =====

export type DayLoad = { date: string; bookings: number; people: number; capacity?: number };
export type SettingChange = { key: string; old: string | null; new: string };
export type Impact =
  | { kind: "capacity"; days: DayLoad[] }
  | { kind: "hours"; closing: DayLoad[]; shortened: DayLoad[] }
  | { kind: "holiday"; day: DayLoad }
  | { kind: "rate"; currency: string; previous: { rate: string; date: string } | null; replacing: string | null; next: { rate: string; date: string } };

// ການຈອງລ່ວງໜ້າສູງສຸດທີ່ເປັນໄປໄດ້ (ຂອບເຂດ max_advance_days) — ນັບຈາກມື້ນີ້
const HORIZON_DAYS = INT_SETTINGS.max_advance_days.max;
const MAX_LISTED_DAYS = 60;

function confirmRequired(details: { changes?: SettingChange[]; impact?: Impact }): never {
  throw new BusinessError(409, "confirm_required", details);
}

async function futureLoad(tx: Db) {
  const today = todayInVientiane();
  return { today, load: await bookingLoadByDate(tx, today, addDays(today, HORIZON_DAYS)) };
}

// ===== ກຸ່ມຄ່າໃນຕາຕະລາງ settings =====

const int = (key: IntSettingKey) => z.number().int().min(INT_SETTINGS[key].min).max(INT_SETTINGS[key].max);
const text = (max: number) => z.string().trim().min(1).max(max);
const gates = z
  .string()
  .transform((v) => [...new Set(v.split(",").map((g) => g.trim().toLowerCase()).filter(Boolean))])
  .refine((list) => list.length > 0 && list.every((g) => GATE_NAME.test(g)), { message: "gates" })
  .transform((list) => list.join(","));

// ບໍ່ໃຫ້ແກ້ໃນ 10b: refund_*_hours (Phase 11) · site_lat/lng (ພາກ 8) · default_currency (ຂໍ້ຕົກລົງ 1)
export const SETTING_GROUPS = {
  online: z.object({
    booking_hold_minutes: int("booking_hold_minutes"),
    max_people_per_booking: int("max_people_per_booking"),
    max_advance_days: int("max_advance_days"),
    booking_create_limit_per_ip: int("booking_create_limit_per_ip"),
    booking_create_window_minutes: int("booking_create_window_minutes"),
    distance_lookup_limit_per_ip: int("distance_lookup_limit_per_ip"),
    distance_lookup_window_minutes: int("distance_lookup_window_minutes"),
  }),
  capacity: z.object({ max_visitors_per_day: int("max_visitors_per_day") }),
  bank: z.object({
    bank_name: text(100),
    bank_account_number: z.string().trim().min(1).max(50),
    bank_account_name: text(150),
    ...Object.fromEntries(NOTE_LOCALES.map((l) => [`verify_time_note_${l}`, text(300)])),
  }),
  pos: z.object({ gates, pos_auto_checkin: z.boolean(), pos_grace_minutes: int("pos_grace_minutes") }),
  system: z.object({
    session_hours: int("session_hours"),
    login_max_attempts: int("login_max_attempts"),
    login_lockout_minutes: int("login_lockout_minutes"),
    translations_reviewed_zh: z.boolean(),
    translations_reviewed_th: z.boolean(),
  }),
} as const;
export type SettingGroup = keyof typeof SETTING_GROUPS;
export const SETTING_GROUP_NAMES = Object.keys(SETTING_GROUPS) as SettingGroup[];

export function isSettingGroup(value: string): value is SettingGroup {
  return (SETTING_GROUP_NAMES as string[]).includes(value);
}

export function groupBodySchema(group: SettingGroup) {
  return z.object({ values: SETTING_GROUPS[group], confirm: z.boolean().optional() });
}

export function groupKeys(group: SettingGroup): string[] {
  return Object.keys(SETTING_GROUPS[group].shape);
}

export async function readSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.settings.findMany({ where: { setting_key: { in: keys } }, select: { setting_key: true, setting_value: true } });
  return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
}

// ຂໍ້ຕົກລົງ 28: ຄ່າໃດຍັງວ່າງ / TODO → ການຈອງ online ປິດ
export function missingBankKeys(values: Record<string, string>): string[] {
  return groupKeys("bank").filter((k) => !isConfigured(values[k]?.trim()));
}

async function capacityDefaultImpact(tx: Db, max: number): Promise<DayLoad[]> {
  const { today, load } = await futureLoad(tx);
  const overrides = await tx.daily_capacity.findMany({
    where: { capacity_date: { gte: isoDateToDb(today) }, time_slot_id: null },
    select: { capacity_date: true },
  });
  const overridden = new Set(overrides.map((o) => dbDateToIso(o.capacity_date)));
  return [...load].filter(([date, l]) => !overridden.has(date) && l.people > max).map(([date, l]) => ({ date, ...l, capacity: max }));
}

export async function saveSettingsGroup(group: SettingGroup, values: Record<string, string | number | boolean>, confirm: boolean, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const keys = Object.keys(values);
    const rows = await tx.$queryRaw<{ setting_key: string; setting_value: string }[]>`
      SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${Prisma.join(keys)}) FOR UPDATE`;
    const old = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
    const changes: SettingChange[] = keys
      .map((key) => ({ key, old: old.get(key) ?? null, new: String(values[key]) }))
      .filter((c) => c.old === null || c.old.trim() !== c.new);
    if (changes.length === 0) return { changed: 0 };

    let impact: Impact | undefined;
    if (group === "capacity") {
      const days = await capacityDefaultImpact(tx, Number(values.max_visitors_per_day));
      if (days.length) impact = { kind: "capacity", days: days.slice(0, MAX_LISTED_DAYS) };
    }
    // ບັນຊີທະນາຄານ: ແກ້ຜິດ = ລູກຄ້າໂອນເງິນໄປບ່ອນຜິດ → ຢືນຢັນຄ່າເກົ່າ-ໃໝ່ສະເໝີ
    if ((group === "bank" || impact) && !confirm) confirmRequired({ changes, impact });

    for (const c of changes) {
      await tx.settings.upsert({
        where: { setting_key: c.key },
        update: { setting_value: c.new, updated_by: actor.id },
        create: { setting_key: c.key, setting_value: c.new, updated_by: actor.id },
      });
    }
    await writeAudit(tx, actor, {
      action: `settings.${group}`,
      table: "settings",
      oldValue: Object.fromEntries(changes.map((c) => [c.key, c.old])),
      newValue: { ...Object.fromEntries(changes.map((c) => [c.key, c.new])), ...(impact && { _impact: impactSummary(impact) }) },
    });
    return { changed: changes.length };
  });
}

// ບັນທຶກໃນ audit ວ່າ admin ຮັບຮູ້ຜົນກະທົບຫຍັງແດ່ຕອນຢືນຢັນ
function impactSummary(impact: Impact): Prisma.InputJsonValue {
  const sum = (days: DayLoad[]) => ({ days: days.length, bookings: days.reduce((a, d) => a + d.bookings, 0), people: days.reduce((a, d) => a + d.people, 0) });
  switch (impact.kind) {
    case "capacity":
      return { overbookedDays: sum(impact.days) };
    case "hours":
      return { closing: sum(impact.closing), shortened: sum(impact.shortened) };
    case "holiday":
      return { bookings: impact.day.bookings, people: impact.day.people };
    case "rate":
      return { previous: impact.previous?.rate ?? null, replacing: impact.replacing };
  }
}

// ===== ເວລາເປີດ-ປິດ (operating_hours) =====

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const hoursSchema = z.object({
  days: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), open: hhmm, close: hhmm, closed: z.boolean() }))
    .length(7)
    .refine((d) => new Set(d.map((x) => x.dayOfWeek)).size === 7, { message: "duplicate_day" })
    .refine((d) => d.every((x) => x.closed || x.close > x.open), { message: "close_before_open" }),
  confirm: z.boolean().optional(),
});

const timeToDb = (hm: string) => new Date(`1970-01-01T${hm}:00.000Z`);
const label = (h: { open: string; close: string; closed: boolean }) => (h.closed ? "closed" : `${h.open}–${h.close}`);

export async function listOperatingHours(db: Db = prisma) {
  const rows = await db.operating_hours.findMany();
  const byDow = new Map(rows.map((r) => [r.day_of_week, r]));
  return Array.from({ length: 7 }, (_, dow) => {
    const r = byDow.get(dow);
    // ບໍ່ມີແຖວ = ປິດ (ຄືກັບ getAvailability)
    return r
      ? { dayOfWeek: dow, open: dbTimeToString(r.open_time).slice(0, 5), close: dbTimeToString(r.close_time).slice(0, 5), closed: r.is_closed }
      : { dayOfWeek: dow, open: "08:00", close: "17:30", closed: true };
  });
}

export async function saveOperatingHours(input: z.infer<typeof hoursSchema>, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM operating_hours FOR UPDATE`;
    const current = new Map((await listOperatingHours(tx)).map((h) => [h.dayOfWeek, h]));
    const changed = input.days.filter((d) => label(d) !== label(current.get(d.dayOfWeek)!));
    if (changed.length === 0) return { changed: 0 };

    const closingDows = new Set(changed.filter((d) => d.closed && !current.get(d.dayOfWeek)!.closed).map((d) => d.dayOfWeek));
    const shortenedDows = new Set(
      changed
        .filter((d) => {
          const c = current.get(d.dayOfWeek)!;
          return !d.closed && !c.closed && (d.open > c.open || d.close < c.close);
        })
        .map((d) => d.dayOfWeek),
    );
    let impact: Impact | undefined;
    if (closingDows.size || shortenedDows.size) {
      const { load } = await futureLoad(tx);
      const pick = (dows: Set<number>) => [...load].filter(([date]) => dows.has(dayOfWeek(date))).map(([date, l]) => ({ date, ...l }));
      const closing = pick(closingDows);
      const shortened = pick(shortenedDows);
      if (closing.length || shortened.length) impact = { kind: "hours", closing: closing.slice(0, MAX_LISTED_DAYS), shortened: shortened.slice(0, MAX_LISTED_DAYS) };
    }
    if (impact && !input.confirm) confirmRequired({ impact });

    for (const d of changed) {
      const data = { open_time: timeToDb(d.open), close_time: timeToDb(d.close), is_closed: d.closed };
      await tx.operating_hours.upsert({ where: { day_of_week: d.dayOfWeek }, update: data, create: { day_of_week: d.dayOfWeek, ...data } });
    }
    await writeAudit(tx, actor, {
      action: "operating_hours.update",
      table: "operating_hours",
      oldValue: Object.fromEntries(changed.map((d) => [`dow${d.dayOfWeek}`, label(current.get(d.dayOfWeek)!)])),
      newValue: { ...Object.fromEntries(changed.map((d) => [`dow${d.dayOfWeek}`, label(d)])), ...(impact && { _impact: impactSummary(impact) }) },
    });
    return { changed: changed.length };
  });
}

// ===== ວັນປິດ / ວັນພິເສດ (holidays) — ວັນທີ່ຜ່ານມາແລ້ວ ອ່ານຢ່າງດຽວ (ຄຳຖາມ B2) =====

const isoDate = z.string().refine(isValidIsoDate, { message: "date" });
const notPast = (d: string) => d >= todayInVientiane();

export const holidaySchema = z.object({
  date: isoDate.refine(notPast, { message: "past_date" }),
  nameLo: text(100),
  nameEn: z.string().trim().max(100).optional().transform((v) => v || null),
  isClosed: z.boolean(),
  confirm: z.boolean().optional(),
});

export async function listHolidays() {
  const rows = await prisma.holidays.findMany({ orderBy: { holiday_date: "desc" }, take: 200 });
  const today = todayInVientiane();
  return rows.map((h) => {
    const date = dbDateToIso(h.holiday_date);
    return { id: String(h.id), date, nameLo: h.name_lo, nameEn: h.name_en, isClosed: h.is_closed, past: date < today };
  });
}

async function dayLoad(tx: Db, date: string): Promise<DayLoad> {
  const l = (await bookingLoadByDate(tx, date, date)).get(date);
  return { date, bookings: l?.bookings ?? 0, people: l?.people ?? 0 };
}

export async function addHoliday(input: z.infer<typeof holidaySchema>, actor: Actor) {
  try {
    return await prisma.$transaction(async (tx) => {
      if (input.isClosed && !input.confirm) {
        const day = await dayLoad(tx, input.date);
        if (day.bookings > 0) confirmRequired({ impact: { kind: "holiday", day } });
      }
      const h = await tx.holidays.create({
        data: { holiday_date: isoDateToDb(input.date), name_lo: input.nameLo, name_en: input.nameEn, is_closed: input.isClosed },
        select: { id: true },
      });
      const day = input.isClosed ? await dayLoad(tx, input.date) : null;
      await writeAudit(tx, actor, {
        action: "holiday.create",
        table: "holidays",
        recordId: h.id,
        newValue: { date: input.date, nameLo: input.nameLo, nameEn: input.nameEn, isClosed: input.isClosed, ...(day?.bookings && { _impact: { bookings: day.bookings, people: day.people } }) },
      });
      return { id: String(h.id) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new BusinessError(409, "holiday_exists");
    throw error;
  }
}

export async function deleteHoliday(id: bigint, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const h = await tx.holidays.findUnique({ where: { id } });
    if (!h) throw new BusinessError(404, "not_found");
    const date = dbDateToIso(h.holiday_date);
    if (!notPast(date)) throw new BusinessError(409, "past_date");
    await tx.holidays.delete({ where: { id } });
    await writeAudit(tx, actor, {
      action: "holiday.delete",
      table: "holidays",
      recordId: id,
      oldValue: { date, nameLo: h.name_lo, nameEn: h.name_en, isClosed: h.is_closed },
    });
  });
}

// ===== ຈຳນວນຮັບສະເພາະວັນ (daily_capacity · ທັງວັນ) =====

export const capacitySchema = z.object({
  date: isoDate.refine(notPast, { message: "past_date" }),
  // null = ລຶບຄ່າສະເພາະວັນ → ກັບໄປໃຊ້ max_visitors_per_day
  maxVisitors: int("max_visitors_per_day").nullable(),
  confirm: z.boolean().optional(),
});

export async function listCapacityOverrides() {
  const today = todayInVientiane();
  const rows = await prisma.daily_capacity.findMany({
    where: { capacity_date: { gte: isoDateToDb(today) }, time_slot_id: null },
    orderBy: { capacity_date: "asc" },
    take: 200,
  });
  const load = rows.length ? await bookingLoadByDate(prisma, today, dbDateToIso(rows[rows.length - 1].capacity_date)) : new Map();
  return rows.map((r) => {
    const date = dbDateToIso(r.capacity_date);
    return { date, maxVisitors: r.max_visitors, people: load.get(date)?.people ?? 0 };
  });
}

export async function setCapacityOverride(input: z.infer<typeof capacitySchema>, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const where = { capacity_date: isoDateToDb(input.date), time_slot_id: null };
    const existing = await tx.daily_capacity.findFirst({ where });
    if ((existing?.max_visitors ?? null) === input.maxVisitors) return { changed: 0 };

    const defaultMax = Number((await tx.settings.findUnique({ where: { setting_key: "max_visitors_per_day" } }))?.setting_value);
    const effective = input.maxVisitors ?? defaultMax;
    const day = await dayLoad(tx, input.date);
    const impact: Impact | undefined = day.people > effective ? { kind: "capacity", days: [{ ...day, capacity: effective }] } : undefined;
    if (impact && !input.confirm) confirmRequired({ impact });

    if (input.maxVisitors === null) {
      await tx.daily_capacity.delete({ where: { id: existing!.id } });
    } else if (existing) {
      await tx.daily_capacity.update({ where: { id: existing.id }, data: { max_visitors: input.maxVisitors } });
    } else {
      await tx.daily_capacity.create({ data: { capacity_date: isoDateToDb(input.date), max_visitors: input.maxVisitors } });
    }
    await writeAudit(tx, actor, {
      action: input.maxVisitors === null ? "capacity.delete" : "capacity.set",
      table: "daily_capacity",
      recordId: existing?.id ?? null,
      oldValue: { date: input.date, maxVisitors: existing?.max_visitors ?? null },
      newValue: { date: input.date, maxVisitors: input.maxVisitors, ...(impact && { _impact: impactSummary(impact) }) },
    });
    return { changed: 1 };
  });
}
