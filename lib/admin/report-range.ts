import { addDays, daysBetween, isValidIsoDate } from "@/lib/time";

// ບໍ່ແຕະ DB — ທົດສອບໄດ້ໂດຍກົງ
export const MAX_REPORT_DAYS = 366;
export const PRESETS = ["today", "last7", "thisMonth", "thisYear"] as const;
export type Preset = (typeof PRESETS)[number];
export type GroupBy = "day" | "month" | "year";

export type ParsedRange =
  | { ok: true; from: string; to: string; groupBy: GroupBy; preset: Preset | null }
  | { ok: false; error: "invalid" | "tooLong"; from: string; to: string; groupBy: GroupBy };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseReportRange(params: Record<string, string | string[] | undefined>, today: string): ParsedRange {
  const g = one(params.groupBy);
  const preset = PRESETS.find((p) => p === one(params.preset)) ?? null;
  const from = one(params.from);
  const to = one(params.to);

  if (preset || (!from && !to)) {
    const p = preset ?? "last7";
    const range = {
      today: [today, today],
      last7: [addDays(today, -6), today],
      thisMonth: [`${today.slice(0, 8)}01`, today],
      thisYear: [`${today.slice(0, 5)}01-01`, today],
    }[p];
    const groupBy: GroupBy = g === "day" || g === "month" || g === "year" ? g : p === "thisYear" ? "month" : "day";
    return { ok: true, from: range[0], to: range[1], groupBy, preset: p };
  }
  const groupBy: GroupBy = g === "month" || g === "year" ? g : "day";
  if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
    return { ok: false, error: "invalid", from: from ?? "", to: to ?? "", groupBy };
  }
  if (daysBetween(from, to) + 1 > MAX_REPORT_DAYS) return { ok: false, error: "tooLong", from, to, groupBy };
  return { ok: true, from, to, groupBy, preset: null };
}
