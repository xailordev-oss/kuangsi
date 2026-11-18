import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReportRange } from "@/lib/admin/report-range";

const T = "2026-11-18";

test("ຄ່າເລີ່ມຕົ້ນ = 7 ວັນ ລວມມື້ນີ້ · ຈັດກຸ່ມຕາມວັນ", () => {
  assert.deepEqual(parseReportRange({}, T), { ok: true, from: "2026-11-12", to: T, groupBy: "day", preset: "last7" });
});

test("preset ເດືອນນີ້ / ປີນີ້ (ປີ → ຈັດກຸ່ມຕາມເດືອນ)", () => {
  assert.deepEqual(parseReportRange({ preset: "thisMonth" }, T), { ok: true, from: "2026-11-01", to: T, groupBy: "day", preset: "thisMonth" });
  assert.deepEqual(parseReportRange({ preset: "thisYear" }, T), { ok: true, from: "2026-01-01", to: T, groupBy: "month", preset: "thisYear" });
});

test("ກຳນົດເອງ: ຖືກ · ກັບກັນ · ຜິດຮູບແບບ · ເກີນ 366 ວັນ", () => {
  assert.equal(parseReportRange({ from: "2026-01-01", to: "2026-03-31", groupBy: "month" }, T).ok, true);
  assert.deepEqual(parseReportRange({ from: "2026-03-01", to: "2026-01-01" }, T), { ok: false, error: "invalid", from: "2026-03-01", to: "2026-01-01", groupBy: "day" });
  assert.equal((parseReportRange({ from: "2026-02-30", to: "2026-03-01" }, T) as { error: string }).error, "invalid");
  assert.equal(parseReportRange({ from: "2025-01-01", to: "2026-01-01" }, T).ok, true); // 366 ວັນ
  assert.equal((parseReportRange({ from: "2025-01-01", to: "2026-01-02" }, T) as { error: string }).error, "tooLong");
});

test("groupBy ທີ່ບໍ່ຮູ້ຈັກ → ວັນ", () => {
  assert.equal(parseReportRange({ from: "2026-01-01", to: "2026-01-02", groupBy: "hour" }, T).groupBy, "day");
});
