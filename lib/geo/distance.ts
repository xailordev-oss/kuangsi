// ໄລຍະທາງ (docs/requirements.md ພາກ 4) — ບໍ່ແຕະ DB ຫຼື DOM: ໃຊ້ໄດ້ທັງ server ແລະ client

export type LatLng = { lat: number; lng: number };

// ຕາດກວາງຊີ — ຫ່າງຈາກເມືອງຫຼວງພະບາງ ປະມານ 29 ກມ ທາງທິດໃຕ້ (CLAUDE.md ພາກ 8)
// TODO: ແຍກເປັນ entrance_gate / parking / main_waterfall (requirements 4.1) ເມື່ອມີພິກັດຢືນຢັນ — ດຽວນີ້ນຳທາງໄປຈຸດນີ້
export const KUANGSI = { lat: 19.74917, lng: 101.99167 } as const satisfies LatLng;

// ຕົວເມືອງຫຼວງພະບາງ (ອ້ອມພະລາຊະວັງ) — ໃຊ້ແທນຕຳແໜ່ງຜູ້ໃຊ້ທີ່ຢູ່ໄກ ເຊັ່ນ ຈອງຈາກຕ່າງປະເທດ (requirements 4.10)
// ເປັນພິກັດ ບໍ່ແມ່ນໄລຍະທາງ — ໄລຍະຍັງຄຳນວນດ້ວຍ routing API (ຂໍ້ຕົກລົງ 8)
// TODO: ຢືນຢັນພິກັດຈຸດອ້າງອີງຕົວເມືອງ
export const LUANG_PRABANG_TOWN = { lat: 19.8917, lng: 102.1345 } as const satisfies LatLng;

// ເກນຂອງ UI (requirements 4.8 / 4.10)
export const ON_SITE_KM = 1;
export const LOW_ACCURACY_M = 1000;
export const FAR_KM = 200; // ໄກກວ່ານີ້ → ສະແດງໄລຍະຈາກຕົວເມືອງ
// API ລົ້ມ → ເສັ້ນຊື່ × 1.5 ພ້ອມໝາຍ "ປະມານ" (ເສັ້ນທາງຄົດຕາມພູ ຍາວກວ່າເສັ້ນຊື່ 1.4–1.6 ເທົ່າ)
export const ROAD_FACTOR_FALLBACK = 1.5;

export function haversineKm(from: LatLng, to: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ຂໍ້ຕົກລົງ 7: ປັດເຫຼືອ 2 ທົດສະນິຍົມ (~1 ກມ) — 3 ຕຳແໜ່ງ (~100 ມ) ຍັງລະບຸຕົວຄົນໄດ້
// ປັດຢູ່ເຄື່ອງຂອງຜູ້ໃຊ້ກ່ອນສົ່ງ ແລະ ປັດຊ້ຳຢູ່ server (ບໍ່ໄວ້ໃຈ client)
export function roundCoord(p: LatLng): LatLng {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { lat: r(p.lat), lng: r(p.lng) };
}

export function originKey(p: LatLng): string {
  const { lat, lng } = roundCoord(p);
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function isValidLatLng(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

export type DistanceTier = "veryNear" | "near" | "medium" | "far";

export function distanceTier(km: number): DistanceTier {
  if (km < 5) return "veryNear";
  if (km <= 50) return "near";
  if (km <= 200) return "medium";
  return "far";
}

// ລິ້ງເປີດແອັບແຜນທີ່ຂອງຜູ້ໃຊ້ (requirements 4.9) — ພິກັດໄປຫາ Google/Apple ຈາກ browser ໂດຍກົງ ບໍ່ຜ່ານ server ເຮົາ
export function mapsDirectionsUrl(from: LatLng | null, to: LatLng = KUANGSI) {
  const d = `${to.lat},${to.lng}`;
  const o = from ? `${from.lat},${from.lng}` : null;
  return {
    google: `https://www.google.com/maps/dir/?api=1${o ? `&origin=${o}` : ""}&destination=${d}&travelmode=driving`,
    apple: `https://maps.apple.com/?${o ? `saddr=${o}&` : ""}daddr=${d}&dirflg=d`,
  };
}
