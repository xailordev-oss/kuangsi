import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

// ICU ຂອງ browser (Chrome) ບໍ່ມີຂໍ້ມູນວັນທີພາສາລາວ → ເຄີຍສະແດງ "2026 M11" ແລະ "S M T…"
// server (Node ມີ CLDR ຄົບ) ສ້າງ template + ຊື່ເດືອນ/ວັນ ແລ້ວສົ່ງໃຫ້ component ຝັ່ງ client ໃຊ້ formatDateParts

type PartType = "weekday" | "day" | "month" | "year" | "literal";
export type DatePart = { type: PartType; value?: string };

export type DateLabels = {
  monthYear: { template: DatePart[]; months: string[] };
  fullDate: { template: DatePart[]; months: string[]; weekdays: string[] };
  weekdaysNarrow: string[];
  yearOffset: number; // ປີພຸດທະສັກກະລາດ (ໄທ) = ປີ ຄ.ສ. + 543
};

const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric", timeZone: "UTC" };
const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };

function template(fmt: Intl.DateTimeFormat, sample: Date): DatePart[] {
  return fmt.formatToParts(sample).map((p) =>
    p.type === "literal" ? { type: "literal", value: p.value } : { type: p.type as PartType },
  );
}

function partOf(fmt: Intl.DateTimeFormat, date: Date, type: string): string {
  return fmt.formatToParts(date).find((p) => p.type === type)?.value ?? "";
}

export function getDateLabels(locale: Locale): DateLabels {
  const tag = INTL_LOCALE[locale];
  const monthYear = new Intl.DateTimeFormat(tag, MONTH_YEAR);
  const fullDate = new Intl.DateTimeFormat(tag, FULL_DATE);
  const narrow = new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" });
  const sample = new Date(Date.UTC(2026, 10, 17));
  const monthDate = (m: number) => new Date(Date.UTC(2026, m, 15));
  // 2024-01-07 ເປັນວັນອາທິດ → index 0 ຄືກັບ operating_hours.day_of_week
  const weekdayDate = (d: number) => new Date(Date.UTC(2024, 0, 7 + d));

  return {
    monthYear: { template: template(monthYear, sample), months: Array.from({ length: 12 }, (_, m) => partOf(monthYear, monthDate(m), "month")) },
    fullDate: {
      template: template(fullDate, sample),
      months: Array.from({ length: 12 }, (_, m) => partOf(fullDate, monthDate(m), "month")),
      weekdays: Array.from({ length: 7 }, (_, d) => partOf(fullDate, weekdayDate(d), "weekday")),
    },
    weekdaysNarrow: Array.from({ length: 7 }, (_, d) => narrow.format(weekdayDate(d))),
    yearOffset: Number(partOf(monthYear, sample, "year").replace(/\D/g, "")) - 2026,
  };
}
