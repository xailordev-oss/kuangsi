import assert from "node:assert/strict";
import { test } from "node:test";
import { decideOffline, needsReview, shouldQueue, type Manifest, type QueuedScan } from "./offline";

const TODAY = "2026-11-18";
const ticket = (code: string, status: Manifest["tickets"][number]["status"], checkedIn = false) => ({
  qrToken: `0000000${code.slice(-1)}-0000-4000-8000-000000000000`,
  bookingCode: code,
  status,
  checkedIn,
  lines: [{ visitorGroup: "lao" as const, ageGroup: "adult" as const, quantity: 2 }],
});
const manifest: Manifest = {
  date: TODAY,
  generatedAt: "2026-11-18T01:00:00Z",
  gates: ["main"],
  tickets: [ticket("KS-AAAA2", "paid"), ticket("KS-AAAA3", "used", true), ticket("KS-AAAA4", "pending"), ticket("KS-AAAA5", "cancelled"), ticket("KS-AAAA6", "expired")],
};
const q = (code: string, localResult: QueuedScan["localResult"]): QueuedScan => ({ offlineId: crypto.randomUUID(), gate: "main", scannedAt: "", bookingCode: code, localResult });

test("ປີ້ paid ທີ່ຍັງບໍ່ເຂົ້າ → offline_ok (ບໍ່ແມ່ນ ok — ສີຕ່າງ)", () => {
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA2" }, []).result, "offline_ok");
  assert.equal(decideOffline(manifest, TODAY, { qrToken: manifest.tickets[0].qrToken.toUpperCase() }, []).result, "offline_ok");
});

test("ຊ້ຳ: ເຂົ້າແລ້ວໃນລາຍການ ຫຼື ເຄື່ອງນີ້ປ່ອຍເຂົ້າແລ້ວຕອນ offline → duplicate", () => {
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA3" }, []).result, "duplicate");
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA2" }, [q("KS-AAAA2", "offline_ok")]).result, "duplicate");
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA2" }, [q("KS-AAAA2", "unpaid")]).result, "offline_ok");
});

test("ສະຖານະອື່ນຕາມລາຍການ: unpaid / cancelled / expired", () => {
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA4" }, []).result, "unpaid");
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA5" }, []).result, "cancelled");
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-AAAA6" }, []).result, "expired");
});

test("ບໍ່ພົບ / ລາຍການຂອງມື້ອື່ນ / ບໍ່ມີລາຍການ → offline_unknown (ບໍ່ສົ່ງ sync)", () => {
  assert.equal(decideOffline(manifest, TODAY, { bookingCode: "KS-ZZZZZ" }, []).result, "offline_unknown");
  assert.equal(decideOffline(manifest, "2026-11-19", { bookingCode: "KS-AAAA2" }, []).result, "offline_unknown");
  assert.equal(decideOffline(null, TODAY, { bookingCode: "KS-AAAA2" }, []).result, "offline_unknown");
  assert.equal(shouldQueue("offline_unknown"), false);
  assert.equal(shouldQueue("offline_ok"), true);
});

test("ຕ້ອງໃຫ້ພະນັກງານກວດ: ປ່ອຍເຂົ້າ offline ແຕ່ server ບໍ່ຜ່ານ", () => {
  assert.equal(needsReview("offline_ok", "duplicate"), true);
  assert.equal(needsReview("offline_ok", "unpaid"), true);
  assert.equal(needsReview("offline_ok", "ok"), false);
  assert.equal(needsReview("duplicate", "duplicate"), false);
});
