import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { TIME_ZONE } from "@/lib/time";

// "{n} ຄົນ" + { n: 3 } → "3 ຄົນ"
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

// ຂໍ້ຕົກລົງ 32: ຕົວເລກໃຊ້ comma ທຸກພາສາ ("25,000") — Intl ຂອງພາສາລາວໃຊ້ຈຸດ ("25.000") ເຊິ່ງສັບສົນກັບທົດສະນິຍົມ
// ໜ່ວຍເງິນ: ລາວ "ກີບ" · ພາສາອື່ນ "LAK" (ມາຈາກ dict.common.kip) — ບໍ່ໃຊ້ ₭ ເພາະຄົນອ່ານບໍ່ຄ່ອຍອອກ
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// ກີບບໍ່ມີທົດສະນິຍົມໃນການໃຊ້ຈິງ — ຄ່າຈາກ API ເປັນ string "25000.00"
export function formatKip(amount: string | number, unit: string): string {
  return `${numberFormat.format(typeof amount === "string" ? Number(amount) : amount)} ${unit}`;
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

// ວັນທີເຂົ້າຊົມເປັນ YYYY-MM-DD (ບໍ່ມີເວລາ) → ສະແດງຕາມ UTC ເພື່ອບໍ່ໃຫ້ເລື່ອນມື້
export function formatVisitDate(isoDate: string, locale: Locale, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC", ...opts,
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

// ເວລາຈິງ (UTC ຈາກ DB) → ສະແດງເປັນເວລາລາວ
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatTime(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}
