import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCALES } from "./config";
import { getDateLabels } from "./date-labels";
import { formatFullDate, formatMonthYear } from "./date-parts";
import { formatVisitDate } from "./format";

// template ຈາກ server ຕ້ອງໃຫ້ຜົນດຽວກັບ Intl ຂອງ Node (CLDR ຄົບ) ທຸກພາສາ
for (const lang of LOCALES) {
  test(`${lang}: formatFullDate == Intl (Node)`, () => {
    const labels = getDateLabels(lang);
    for (const iso of ["2026-01-04", "2026-11-17", "2027-02-28", "2026-12-31"]) {
      assert.equal(formatFullDate(labels, iso), formatVisitDate(iso, lang), `${lang} ${iso}`);
    }
  });
}

test("ລາວ: ເດືອນ ແລະ ວັນ ເປັນພາສາລາວ (ບໍ່ແມ່ນ M11 / S M T)", () => {
  const labels = getDateLabels("lo");
  assert.equal(formatMonthYear(labels, "2026-11"), "ພະຈິກ 2026");
  assert.equal(labels.weekdaysNarrow[2], "ອ");
});

test("ໄທ: ປີພຸດທະສັກກະລາດ", () => {
  assert.equal(formatMonthYear(getDateLabels("th"), "2026-11"), "พฤศจิกายน 2569");
});
