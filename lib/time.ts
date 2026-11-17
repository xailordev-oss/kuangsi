// ເກັບເປັນ UTC · ວັນທີເຂົ້າຊົມ ແລະ ເວລາເປີດ-ປິດ ຄິດຕາມເວລາລາວ
export const TIME_ZONE = "Asia/Vientiane";

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function todayInVientiane(now = new Date()): string {
  return dateFmt.format(now);
}

export function timeNowInVientiane(now = new Date()): string {
  return timeFmt.format(now);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// ຄໍລຳ DATE ຂອງ MySQL ↔ Date ຂອງ Prisma (ທ່ຽງຄືນ UTC)
export function isoDateToDb(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dbDateToIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// ຄໍລຳ TIME ຂອງ MySQL ມາເປັນ Date 1970-01-01T..Z
export function dbTimeToString(value: Date): string {
  return value.toISOString().slice(11, 19);
}

// 0 = ອາທິດ … 6 = ເສົາ (ຄືກັບ operating_hours.day_of_week)
export function dayOfWeek(isoDate: string): number {
  return isoDateToDb(isoDate).getUTCDay();
}

export function addDays(isoDate: string, days: number): string {
  const d = isoDateToDb(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return dbDateToIso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((isoDateToDb(to).getTime() - isoDateToDb(from).getTime()) / 86_400_000);
}
