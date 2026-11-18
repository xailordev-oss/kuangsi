import type { Report } from "@/lib/admin/stats";
import { countryNamesFor } from "@/lib/country-names";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { formatKip, formatNumber, formatVisitDate, t } from "@/lib/i18n/format";
import type { StaffDictionary, StaffLocale } from "@/lib/i18n/staff";

export type ReportRow = { section: string; label: string; value: number; display: string; count?: number };
export type ReportSection = { id: string; title: string; hint?: string; kind: "money" | "people"; rows: ReportRow[]; total?: string };

// ຊຸດດຽວກັນໃຊ້ທັງໜ້າລາຍງານ ແລະ CSV (ຕົວເລກລວມ — ບໍ່ມີຊື່ ຫຼື ເບີໂທ · P10-4)
export function reportSections(r: Report, dict: StaffDictionary, locale: StaffLocale): ReportSection[] {
  const a = dict.admin;
  const kip = (n: number) => formatKip(n, dict.common.kip);
  const people = (n: number) => t(a.reports.people, { n: formatNumber(n) });
  const groupAge = (key: string) => {
    const [g, age] = key.split(":") as ["lao" | "foreigner", keyof typeof dict.scan.age];
    return `${g === "lao" ? dict.scan.groupLao : dict.scan.groupForeigner} ${dict.scan.age[age] ?? age}`;
  };
  const period = (key: string) =>
    r.groupBy === "day" ? formatVisitDate(key, locale, { weekday: undefined, month: "short" }) : r.groupBy === "month" ? formatVisitDate(`${key}-01`, locale, { weekday: undefined, day: undefined, month: "long" }) : key;
  const weekdayFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: "UTC" });
  const countries = countryNamesFor(locale);
  const money = (id: string, title: string, rows: { key: string; amount: number; count: number }[], label: (k: string) => string, hint?: string): ReportSection => ({
    id,
    title,
    hint,
    kind: "money",
    rows: rows.map((x) => ({ section: title, label: label(x.key), value: x.amount, display: kip(x.amount), count: x.count })),
    total: kip(rows.reduce((s, x) => s + x.amount, 0)),
  });
  const ppl = (id: string, title: string, rows: { key: string | number; people: number }[], label: (k: string | number) => string, hint?: string): ReportSection => ({
    id,
    title,
    hint,
    kind: "people",
    rows: rows.map((x) => ({ section: title, label: label(x.key), value: x.people, display: people(x.people) })),
    total: people(rows.reduce((s, x) => s + x.people, 0)),
  });

  return [
    money("revenue", a.reports.revenue, r.revenue, period, a.reports.revenueBasis),
    money("channel", a.reports.byChannel, r.byChannel, (k) => a.channel[k as keyof typeof a.channel] ?? k, a.reports.revenueBasis),
    money("method", a.reports.byMethod, r.byMethod, (k) => a.method[k as keyof typeof a.method] ?? k, a.reports.revenueBasis),
    ppl("entered", a.reports.entered, r.enteredByGroup, (k) => groupAge(String(k)), a.reports.group),
    ppl("booked", a.reports.booked, r.bookedByGroup, (k) => groupAge(String(k)), a.reports.group),
    ppl("nationality", a.reports.nationality, r.nationality, (k) => (k ? (countries[String(k)] ?? String(k)) : a.reports.unknown)),
    // 2024-01-07 ເປັນວັນອາທິດ → key 0
    ppl("weekday", a.reports.weekday, r.weekday, (k) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 7 + Number(k))))),
    ppl("hour", a.reports.hour, r.hour, (k) => t(a.reports.hourLabel, { h: String(k).padStart(2, "0") })),
  ];
}

// CSV ສຳລັບ Excel: BOM UTF-8 (ໃຫ້ອ່ານລາວໄດ້) · ຄ່າທີ່ມີ , " ຂຶ້ນແຖວໃໝ່ ຖືກໃສ່ໃນ ""
export function toCsv(sections: ReportSection[], dict: StaffDictionary, header: string[]): string {
  const c = dict.admin.reports.csv;
  const esc = (v: string | number) => {
    const s = String(v);
    // ກັນ formula injection ໃນ spreadsheet
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [header.map(esc).join(","), [c.section, c.item, c.amount, c.count, c.people].map(esc).join(",")];
  for (const s of sections) {
    for (const r of s.rows) {
      lines.push([s.title, r.label, s.kind === "money" ? r.value : "", r.count ?? "", s.kind === "people" ? r.value : ""].map(esc).join(","));
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
