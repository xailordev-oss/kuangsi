import assert from "node:assert/strict";
import { test } from "node:test";
import { openingInstant, pickTier, quoteRefund, refundAmount } from "@/lib/refunds/policy";

const TIERS = [
  { hoursBefore: 12, refundPercent: 50 },
  { hoursBefore: 24, refundPercent: 100 },
];

test("ເວລາເປີດຂອງວັນເຂົ້າຊົມ = ເວລາລາວ (+07)", () => {
  assert.equal(openingInstant("2026-11-20", "08:00:00").toISOString(), "2026-11-20T01:00:00.000Z");
  assert.equal(openingInstant("2026-11-20", null).toISOString(), "2026-11-19T17:00:00.000Z");
});

test("ເລືອກຂັ້ນ: ຂອບເຂດ 24 / 12 ຊມ ພໍດີ ເຂົ້າຂັ້ນນັ້ນ · ລຳດັບໃນຕາຕະລາງບໍ່ສຳຄັນ", () => {
  assert.deepEqual(pickTier(TIERS, 30), { percent: 100, tierHours: 24 });
  assert.deepEqual(pickTier(TIERS, 24), { percent: 100, tierHours: 24 });
  assert.deepEqual(pickTier(TIERS, 23.99), { percent: 50, tierHours: 12 });
  assert.deepEqual(pickTier(TIERS, 12), { percent: 50, tierHours: 12 });
  assert.deepEqual(pickTier(TIERS, 11.99), { percent: 0, tierHours: null });
  assert.deepEqual(pickTier(TIERS, -3), { percent: 0, tierHours: null });
  assert.deepEqual(pickTier([], 100), { percent: 0, tierHours: null });
});

test("ຈຳນວນຄືນ: ປັດລົງເປັນກີບເຕັມ · ບໍ່ເກີນຍອດທີ່ຈ່າຍ", () => {
  assert.equal(refundAmount(130_000, 50), 65_000);
  assert.equal(refundAmount(65_001, 50), 32_500);
  assert.equal(refundAmount(99_999, 33), 32_999);
  assert.equal(refundAmount(130_000, 100), 130_000);
  assert.equal(refundAmount(130_000, 0), 0);
});

test("quoteRefund: ນັບຈາກເວລາເປີດ ບໍ່ແມ່ນ 00:00 (ຂໍ້ຕົກລົງ 54)", () => {
  // ເຂົ້າຊົມ 20/11 ເປີດ 08:00 ລາວ · ກົດ 19/11 09:00 ລາວ = ເຫຼືອ 23 ຊມ → 50% (ຖ້ານັບຈາກ 00:00 ຈະເຫຼືອ 15 ຊມ)
  const now = new Date("2026-11-19T02:00:00Z");
  const q = quoteRefund(TIERS, 130_000, "2026-11-20", "08:00:00", now);
  assert.equal(q.hoursLeft, 23);
  assert.equal(q.percent, 50);
  assert.equal(q.amount, 65_000);
  // ກົດ 19/11 07:59 ລາວ = ເຫຼືອ 24 ຊມ 1 ນາທີ → 100%
  assert.equal(quoteRefund(TIERS, 130_000, "2026-11-20", "08:00:00", new Date("2026-11-19T00:59:00Z")).percent, 100);
});
