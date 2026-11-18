import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceTier, haversineKm, isValidLatLng, KUANGSI, LUANG_PRABANG_TOWN, mapsDirectionsUrl, originKey, roundCoord } from "@/lib/geo/distance";

test("haversine: ຈຸດດຽວກັນ = 0 · ສົມມາດ", () => {
  assert.equal(haversineKm(KUANGSI, KUANGSI), 0);
  assert.equal(haversineKm(KUANGSI, LUANG_PRABANG_TOWN), haversineKm(LUANG_PRABANG_TOWN, KUANGSI));
});

test("haversine: ຄ່າທີ່ຮູ້ — 1° latitude ≈ 111.19 ກມ", () => {
  assert.ok(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111.19) < 0.01);
});

test("haversine: ຕົວເມືອງ → ຕາດ ເສັ້ນຊື່ສັ້ນກວ່າ 29 ກມ ຂອງຖະໜົນ (ທາງຄົດຕາມພູ)", () => {
  const km = haversineKm(LUANG_PRABANG_TOWN, KUANGSI);
  assert.ok(km > 15 && km < 29, String(km));
});

test("ປັດພິກັດ 2 ທົດສະນິຍົມ (ຂໍ້ຕົກລົງ 7) — ບໍ່ເຫຼືອພິກັດແທ້", () => {
  assert.deepEqual(roundCoord({ lat: 19.887654, lng: 102.135432 }), { lat: 19.89, lng: 102.14 });
  assert.equal(originKey({ lat: 19.887654, lng: 102.135432 }), "19.89,102.14");
  assert.equal(originKey({ lat: 19.9, lng: 102.1 }), "19.90,102.10");
  assert.equal(originKey({ lat: -0.004, lng: 0 }), "0.00,0.00");
});

test("ລະດັບໄກ-ໃກ້ (requirements 4.8)", () => {
  assert.deepEqual([1, 4.99, 5, 50, 50.1, 200, 200.1].map(distanceTier), ["veryNear", "veryNear", "near", "near", "medium", "medium", "far"]);
});

test("ກວດພິກັດ", () => {
  assert.ok(isValidLatLng({ lat: 19.8, lng: 102.1 }));
  assert.ok(!isValidLatLng({ lat: 91, lng: 0 }));
  assert.ok(!isValidLatLng({ lat: NaN, lng: 0 }));
});

test("deep link ໄປ Google / Apple Maps", () => {
  const u = mapsDirectionsUrl({ lat: 19.89, lng: 102.14 });
  assert.equal(u.google, "https://www.google.com/maps/dir/?api=1&origin=19.89,102.14&destination=19.74917,101.99167&travelmode=driving");
  assert.equal(u.apple, "https://maps.apple.com/?saddr=19.89,102.14&daddr=19.74917,101.99167&dirflg=d");
  assert.ok(!mapsDirectionsUrl(null).google.includes("origin="));
});
