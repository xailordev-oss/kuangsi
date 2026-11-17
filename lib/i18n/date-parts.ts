import type { DateLabels, DatePart } from "@/lib/i18n/date-labels";

// ໃຊ້ໄດ້ທັງ client ແລະ server — ບໍ່ອີງ Intl ຂອງ browser (ເບິ່ງ lib/i18n/date-labels.ts)
function fill(template: DatePart[], values: Partial<Record<DatePart["type"], string>>): string {
  return template.map((p) => (p.type === "literal" ? p.value : values[p.type] ?? "")).join("");
}

// "2026-11" → "ພະຈິກ 2026"
export function formatMonthYear(labels: DateLabels, yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return fill(labels.monthYear.template, { month: labels.monthYear.months[m - 1], year: String(y + labels.yearOffset) });
}

// "2026-11-17" → "ວັນອັງຄານ, 17 ພະຈິກ 2026"
export function formatFullDate(labels: DateLabels, isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return fill(labels.fullDate.template, {
    weekday: labels.fullDate.weekdays[weekday],
    day: String(d),
    month: labels.fullDate.months[m - 1],
    year: String(y + labels.yearOffset),
  });
}
