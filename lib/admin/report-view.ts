import type { CashFlow, Report } from "@/lib/admin/stats";
import { countryNamesFor } from "@/lib/country-names";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { formatKip, formatNumber, formatVisitDate, t } from "@/lib/i18n/format";
import type { StaffDictionary, StaffLocale } from "@/lib/i18n/staff";

// ເງິນ: 3 ຖັນສະເໝີ ຮັບ · ຄືນ · ສຸດທິ (ຂໍ້ຕົກລົງ 44) · ຄົນ: 1 ຖັນ
export type FlowRow = { label: string; received: number; refunded: number; net: number };
export type PeopleRow = { label: string; value: number; display: string };
export type ReportSection =
  | { id: string; kind: "flow"; title: string; hint?: string; rows: FlowRow[]; total: FlowRow }
  | { id: string; kind: "people"; title: string; hint?: string; rows: PeopleRow[]; total: string };

export function flowRows(rows: CashFlow[], label: (key: string) => string): FlowRow[] {
  return rows.map((r) => ({ label: label(r.key), received: r.received, refunded: r.refunded, net: r.net }));
}

// ຊຸດດຽວກັນໃຊ້ທັງໜ້າລາຍງານ ແລະ CSV (ຕົວເລກລວມ — ບໍ່ມີຊື່ ຫຼື ເບີໂທ · P10-4)
export function reportSections(r: Report, dict: StaffDictionary, locale: StaffLocale): ReportSection[] {
  const a = dict.admin;
  const people = (n: number) => t(a.reports.people, { n: formatNumber(n) });
  const groupAge = (key: string) => {
    const [g, age] = key.split(":") as ["lao" | "foreigner", keyof typeof dict.scan.age];
    return `${g === "lao" ? dict.scan.groupLao : dict.scan.groupForeigner} ${dict.scan.age[age] ?? age}`;
  };
  const period = (key: string) =>
    r.groupBy === "day"
      ? formatVisitDate(key, locale, { weekday: undefined, month: "short" })
      : r.groupBy === "month"
        ? formatVisitDate(`${key}-01`, locale, { weekday: undefined, day: undefined, month: "long" })
        : key;
  const weekdayFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: "UTC" });
  const countries = countryNamesFor(locale);
  const totalRow = { label: a.reports.total, ...r.money };
  const flow = (id: string, title: string, rows: FlowRow[]): ReportSection => ({ id, kind: "flow", title, hint: a.reports.moneyBasis, rows, total: totalRow });
  const ppl = (id: string, title: string, rows: { key: string | number; people: number }[], label: (k: string | number) => string, hint?: string): ReportSection => ({
    id,
    kind: "people",
    title,
    hint,
    rows: rows.map((x) => ({ label: label(x.key), value: x.people, display: people(x.people) })),
    total: people(rows.reduce((s, x) => s + x.people, 0)),
  });

  return [
    flow("money", a.reports.money, flowRows(r.revenue, period)),
    flow("channel", a.reports.byChannel, flowRows(r.byChannel, (k) => a.channel[k as keyof typeof a.channel] ?? k)),
    flow("method", a.reports.byMethod, flowRows(r.byMethod, (k) => a.method[k as keyof typeof a.method] ?? k)),
    ppl("entered", a.reports.entered, r.enteredByGroup, (k) => groupAge(String(k)), a.reports.group),
    ppl("booked", a.reports.booked, r.bookedByGroup, (k) => groupAge(String(k)), a.reports.group),
    ppl("nationality", a.reports.nationality, r.nationality, (k) => (k ? (countries[String(k)] ?? String(k)) : a.reports.unknown)),
    // 2024-01-07 ເປັນວັນອາທິດ → key 0
    ppl("weekday", a.reports.weekday, r.weekday, (k) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 7 + Number(k))))),
    ppl("hour", a.reports.hour, r.hour, (k) => t(a.reports.hourLabel, { h: String(k).padStart(2, "0") })),
  ];
}

export const kipFormatter = (dict: StaffDictionary) => (n: number) => formatKip(n, dict.common.kip);

// CSV ສຳລັບ Excel: BOM UTF-8 (ໃຫ້ອ່ານລາວໄດ້) · ຄ່າທີ່ມີ , " ຂຶ້ນແຖວໃໝ່ ຖືກໃສ່ໃນ ""
export function toCsv(sections: ReportSection[], dict: StaffDictionary, header: string[]): string {
  const c = dict.admin.reports.csv;
  const esc = (v: string | number) => {
    const s = String(v);
    // ກັນ formula injection ໃນ spreadsheet (ຕົວເລກລົບບໍ່ແມ່ນ formula — ປ່ອຍໄວ້)
    const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [header.map(esc).join(","), [c.section, c.item, c.received, c.refunded, c.net, c.people].map(esc).join(",")];
  for (const s of sections) {
    if (s.kind === "flow") {
      for (const r of [...s.rows, s.total]) lines.push([s.title, r.label, r.received, r.refunded, r.net, ""].map(esc).join(","));
    } else {
      for (const r of s.rows) lines.push([s.title, r.label, "", "", "", r.value].map(esc).join(","));
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
