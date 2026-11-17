# ລະບົບຈອງປີ້ທ່ອງທ່ຽວ ຕາດກວາງຊີ — ຂໍ້ມູນທີ່ຕ້ອງມີ

> ເອກະສານສະຫຼຸບຄວາມຕ້ອງການຂໍ້ມູນ (data requirements) ສຳລັບລະບົບຈອງປີ້ເຂົ້າຊົມຕາດກວາງຊີ

---

## 1. ຕາຕະລາງຫຼັກ (Core Tables)

### 1.1 ປະເພດປີ້ — `ticket_types`

| ຟິລ | ປະເພດ | ຄຳອະທິບາຍ |
|---|---|---|
| `id` | PK | |
| `name_lo` / `name_en` | string | ຊື່ປະເພດປີ້ (ຫຼາຍພາສາ) |
| `visitor_group` | enum | `lao` / `foreigner` — ລາຄາຕ່າງກັນ |
| `age_group` | enum | `adult` / `child` / `senior` / `free` |
| `price` | decimal | ລາຄາ |
| `currency` | enum | `LAK` / `USD` / `THB` |
| `is_active` | boolean | ເປີດ/ປິດຂາຍ |

### 1.2 ຜູ້ຈອງ — `customers`

- `full_name` — ຊື່-ນາມສະກຸນ
- `phone` — ເບີໂທ (ໃຊ້ຕິດຕໍ່ ແລະ ຢືນຢັນ)
- `email` — ສົ່ງປີ້ + ໃບຮັບເງິນ
- `nationality` — ສັນຊາດ (ຕັດສິນລາຄາ + ເຮັດລາຍງານ)
- `id_number` — ເລກບັດປະຈຳຕົວ / passport (ຖ້າຕ້ອງການຢືນຢັນຕົວຕົນ)

### 1.3 ການຈອງ — `bookings`

- `booking_code` — ລະຫັດຈອງ (ສັ້ນ, ອ່ານງ່າຍ ເຊັ່ນ `KS-7X4K9`)
- `qr_token` — ສຳລັບສະແກນເຂົ້າປະຕູ
- `visit_date` — ວັນທີເຂົ້າຊົມ
- `time_slot` — ຮອບເວລາ (ຖ້າຈຳກັດຮອບ)
- `items[]` — ຈຳນວນແຕ່ລະປະເພດປີ້
- `subtotal`, `discount`, `total_amount`
- `status` — `pending` / `paid` / `used` / `cancelled` / `expired`
- `channel` — `online` / `gate` / `tour_agency`
- `created_at`, `updated_at`

### 1.4 ການຈ່າຍເງິນ — `payments`

- `method` — BCEL One, LDB, OnePay, ບັດເຄຣດິດ, ເງິນສົດ
- `transaction_id` — ເລກອ້າງອີງຈາກ gateway
- `proof_url` — ຫຼັກຖານການໂອນ (ຖ້າໂອນເອງ)
- `paid_at` — ເວລາຈ່າຍ
- `status` — `pending` / `success` / `failed` / `refunded`
- `refund_amount`, `refund_reason`, `refunded_at`

### 1.5 ການກວດປີ້ເຂົ້າ — `check_ins`

- `booking_id` — ປີ້ໃດ
- `gate` — ປະຕູໃດ
- `scanned_at` — ເວລາສະແກນ
- `scanned_by` — ພະນັກງານຜູ້ສະແກນ
- **ກົດ**: ປີ້ 1 ອັນ ສະແກນຜ່ານໄດ້ຄັ້ງດຽວ (ປ້ອງກັນໃຊ້ຊ້ຳ)

### 1.6 ຜູ້ໃຊ້ລະບົບ — `users` / `roles`

| ບົດບາດ | ສິດທິ |
|---|---|
| Admin | ຈັດການທັງໝົດ, ຕັ້ງລາຄາ, ຈັດການຜູ້ໃຊ້ |
| ພະນັກງານຂາຍປີ້ | ຂາຍປີ້ຢູ່ປະຕູ, ພິມປີ້ |
| ພະນັກງານກວດປີ້ | ສະແກນ QR ເທົ່ານັ້ນ |
| ຜູ້ເບິ່ງລາຍງານ | ອ່ານລາຍງານ, ບໍ່ແກ້ຂໍ້ມູນ |

---

## 2. ຂໍ້ມູນເພີ່ມທີ່ຄວນຄິດໄວ້ແຕ່ຕົ້ນ

### 2.1 ບໍລິການເສີມ — `add_ons`
ລົດຮັບສົ່ງ · ໄກ້ນຳທ່ຽວ · ຕູ້ຝາກຂອງ · ເຂົ້າຊົມສູນໝີ · ຈຸດປິກນິກ

### 2.2 ຈຳນວນຈຳກັດ — `capacity`
- ຈຳນວນຄົນສູງສຸດຕໍ່ວັນ ຫຼື ຕໍ່ຮອບເວລາ
- ປ້ອງກັນການຂາຍເກີນ (overbooking)

### 2.3 ຕາຕະລາງເປີດ-ປິດ — `operating_hours` / `holidays`
- ເວລາເປີດ-ປິດແຕ່ລະວັນ
- ວັນທີປິດບໍລິການພິເສດ

### 2.4 ອັດຕາແລກປ່ຽນ — `exchange_rates`
ຈຳເປັນຖ້າຮັບຫຼາຍສະກຸນເງິນ (ເກັບປະຫວັດອັດຕາໄວ້ ເພື່ອໃຫ້ລາຍງານຍ້ອນຫຼັງຖືກຕ້ອງ)

### 2.5 ນະໂຍບາຍຍົກເລີກ/ຄືນເງິນ
ຕົວຢ່າງ: ຍົກເລີກກ່ອນ 24 ຊົ່ວໂມງ ຄືນ 100% · ກ່ອນ 12 ຊົ່ວໂມງ ຄືນ 50% · ຫຼັງຈາກນັ້ນ ບໍ່ຄືນ

### 2.6 ຫຼາຍພາສາ
ລາວ · ອັງກິດ · ຈີນ · ໄທ — ທັງ UI, ປີ້, ແລະ ອີເມວຢືນຢັນ

### 2.7 ລາຍງານ
- ລາຍໄດ້ຕໍ່ວັນ / ຕໍ່ເດືອນ / ຕໍ່ປີ
- ຈຳນວນນັກທ່ອງທ່ຽວຕາມສັນຊາດ
- ຊ່ວງເວລາ ແລະ ລະດູທີ່ຄົນມາຫຼາຍ
- ແຍກຕາມຊ່ອງທາງຈອງ (online vs ປະຕູ vs ບໍລິສັດທັດສະນາຈອນ)

### 2.8 Audit Log
ບັນທຶກວ່າ **ໃຜ · ແກ້ຫຍັງ · ເວລາໃດ** — ສຳຄັນຫຼາຍສຳລັບລະບົບທີ່ກ່ຽວຂ້ອງກັບເງິນ

---

## 3. ສິ່ງທີ່ຕ້ອງຢືນຢັນກັບຜູ້ຈັດການຕາດກວາງຊີ

- [ ] ລາຄາປີ້ແທ້ (ຄົນລາວ / ຄົນຕ່າງປະເທດ)
- [ ] ອາຍຸເດັກທີ່ເຂົ້າຟຣີ ແລະ ອາຍຸທີ່ນັບເປັນຜູ້ໃຫຍ່
- [ ] ມີສ່ວນຫຼຸດກຸ່ມ / ນັກຮຽນ / ພະນັກງານລັດ ບໍ?
- [ ] ຈຳນວນນັກທ່ອງທ່ຽວສູງສຸດທີ່ຮັບໄດ້ຕໍ່ວັນ
- [ ] ຊ່ອງທາງຈ່າຍເງິນທີ່ມີຢູ່ແລ້ວ (BCEL One? OnePay?)
- [ ] ນະໂຍບາຍຄືນເງິນທີ່ໃຊ້ຢູ່ປັດຈຸບັນ

> ໝາຍເຫດ: ລາຄາປີ້ ແລະ ກົດລະບຽບມີການປັບປ່ຽນເປັນໄຕມາດ ຄວນຢືນຢັນກ່ອນເລີ່ມພັດທະນາ

---

## 4. ຟັງຊັນບອກໄລຍະທາງ (Distance & Navigation)

ໃຫ້ຜູ້ໃຊ້ຮູ້ວ່າ **ຕົນເອງຢູ່ຈຸດໃດ** ແລະ **ຫ່າງຈາກຕາດກວາງຊີເທົ່າໃດ ກິໂລແມັດ** ພ້ອມເວລາເດີນທາງ

### 4.1 ພິກັດຈຸດໝາຍ (ຄົງທີ່ — ເກັບໃນ config)

```ts
// lib/constants.ts
export const KUANGSI = {
  name_lo: 'ຕາດກວາງຊີ',
  name_en: 'Kuang Si Falls',
  lat: 19.74917,
  lng: 101.99167,
  // ຫ່າງຈາກເມືອງຫຼວງພະບາງ ປະມານ 29 ກມ ທາງທິດໃຕ້
} as const;
```

ຄວນເກັບແຍກເປັນ 3 ຈຸດ ເພາະໃຊ້ຕ່າງກັນ:

| ຈຸດ | ໃຊ້ເຮັດຫຍັງ |
|---|---|
| `entrance_gate` | ຈຸດນຳທາງ (navigation destination) |
| `parking` | ບອກບ່ອນຈອດລົດ |
| `main_waterfall` | ສູນກາງແຜນທີ່ພາຍໃນ |

### 4.2 ຂໍ້ມູນທີ່ຕ້ອງເອົາຈາກຜູ້ໃຊ້

```ts
type UserOrigin = {
  lat: number;
  lng: number;
  accuracy: number;        // ຄວາມແມ່ນຍຳ (ແມັດ) — ຈາກ GPS
  source: 'gps' | 'manual' | 'ip';
  label?: string;          // ຊື່ບ່ອນ ເຊັ່ນ "ໂຮງແຮມ Mekong Riverview"
};
```

**3 ວິທີຫາຕຳແໜ່ງ ຈັດລຳດັບຄວາມແມ່ນຍຳ:**

1. **GPS ຜ່ານ browser** (ແມ່ນທີ່ສຸດ) — ຕ້ອງໃຊ້ HTTPS ເທົ່ານັ້ນ
2. **ເລືອກເອງ** — dropdown ບ່ອນພັກຍອດນິຍົມ ຫຼື ແຕະໃສ່ແຜນທີ່ (ສຳລັບຜູ້ທີ່ປະຕິເສດ GPS)
3. **IP geolocation** (ຢາບ, ±10 ກມ) — ໃຊ້ເປັນຄ່າເລີ່ມຕົ້ນເທົ່ານັ້ນ

### 4.3 ສອງແບບຂອງ "ໄລຍະທາງ" — ຕ້ອງແຍກໃຫ້ຊັດ

| ແບບ | ຄຳນວນແນວໃດ | ຄ່າໃຊ້ຈ່າຍ | ເໝາະກັບ |
|---|---|---|---|
| **ເສັ້ນຊື່** (straight-line) | ສູດ Haversine ໃນເຄື່ອງ | ຟຣີ | ສະແດງໄວ, ຈັດລຳດັບໃກ້-ໄກ |
| **ເສັ້ນທາງຖະໜົນ** (road distance) | ເອີ້ນ routing API | ມີຄ່າ | ບອກ ກມ + ເວລາຂັບລົດຈິງ |

> ຢູ່ຫຼວງພະບາງ ເສັ້ນທາງຄົດຕາມພູ — ໄລຍະຖະໜົນຈິງ **ຫຼາຍກວ່າ** ເສັ້ນຊື່ປະມານ 1.4–1.6 ເທົ່າ ຈຶ່ງບໍ່ຄວນໃຊ້ Haversine ບອກຜູ້ໃຊ້ໂດຍກົງ

### 4.4 ສູດ Haversine (ໃຊ້ໄດ້ທັນທີ ບໍ່ຕ້ອງເອີ້ນ API)

```ts
// lib/distance.ts
export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const R = 6371; // ລັດສະໝີໂລກ (ກມ)
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}
```

### 4.5 ດຶງຕຳແໜ່ງຜູ້ໃຊ້ (React hook)

```ts
'use client';
import { useState } from 'react';

export function useMyLocation() {
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setError('ອຸປະກອນນີ້ບໍ່ຮອງຮັບການຫາຕຳແໜ່ງ');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords(pos.coords); setLoading(false); },
      (err) => {
        const msg = {
          1: 'ທ່ານປະຕິເສດການແບ່ງປັນຕຳແໜ່ງ — ກະລຸນາເລືອກຈຸດເລີ່ມຕົ້ນເອງ',
          2: 'ຫາຕຳແໜ່ງບໍ່ໄດ້ — ກວດສັນຍານ GPS',
          3: 'ໝົດເວລາລໍຖ້າ — ລອງໃໝ່',
        }[err.code] ?? 'ເກິດຂໍ້ຜິດພາດ';
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 }
    );
  };

  return { coords, error, loading, locate };
}
```

### 4.6 ຕົວເລືອກ Routing API

| ບໍລິການ | ຈຸດດີ | ຂໍ້ຄວນລະວັງ |
|---|---|---|
| **Google Routes API** | ຂໍ້ມູນຖະໜົນລາວດີທີ່ສຸດ, ມີສະພາບຈໍລະຈອນ | ມີຄ່າໃຊ້ຈ່າຍຕໍ່ການເອີ້ນ, ຕ້ອງໃສ່ບັດ |
| **Mapbox Directions** | ຮາຄາຖືກກວ່າ, free tier ພໍໃຊ້ | ຂໍ້ມູນເສັ້ນທາງຊົນນະບົດລາວນ້ອຍກວ່າ |
| **OpenRouteService** | ຟຣີ 2,000 ຄັ້ງ/ວັນ | ອາດຊ້າ, ອາໄສ OpenStreetMap |
| **OSRM (self-host)** | ຟຣີບໍ່ຈຳກັດ | ຕ້ອງຕັ້ງ server ເອງ |

**ຄຳແນະນຳ**: ເລີ່ມດ້ວຍ OpenRouteService ຕອນພັດທະນາ → ປ່ຽນເປັນ Google ເມື່ອເປີດໃຊ້ຈິງ (ອອກແບບເປັນ interface ດຽວ ເພື່ອສັບປ່ຽນໄດ້ງ່າຍ)

```ts
// lib/routing.ts
export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  provider: string;
}

export interface RoutingProvider {
  getRoute(from: LatLng, to: LatLng): Promise<RouteResult>;
}
```

### 4.7 ການ cache — ສຳຄັນຕໍ່ຄ່າໃຊ້ຈ່າຍ

- ປັດພິກັດໃຫ້ເຫຼືອ **2 ຕຳແໜ່ງທົດສະນິຍົມ (~1 ກມ)** ແລ້ວໃຊ້ເປັນ cache key
  (3 ຕຳແໜ່ງ = ~100 ມ ຍັງລະບຸຕົວຜູ້ໃຊ້ໄດ້ ຂັດກັບຂໍ້ 4.11)
- ເກັບຜົນໄວ້ 7 ວັນ (ເສັ້ນທາງບໍ່ປ່ຽນເລື້ອຍ)
- ຄຳນວນ ແລະ ເກັບໄວ້ລ່ວງໜ້າ (pre-compute) ສຳລັບໂຮງແຮມ/ຈຸດທ່ອງທ່ຽວຍອດນິຍົມໃນຫຼວງພະບາງ
- ຖ້າ API ລົ້ມ → ໃຊ້ Haversine × 1.5 ເປັນຄ່າປະມານ ພ້ອມໝາຍວ່າ "ປະມານ"

```sql
CREATE TABLE route_cache (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_key   VARCHAR(32)  NOT NULL,   -- "19.89,102.14" (ປັດ 2 ທົດສະນິຍົມ)
  distance_km  DECIMAL(8,2) NOT NULL,
  duration_min INT UNSIGNED NOT NULL,
  provider     VARCHAR(32)  NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_cache_origin (origin_key)
) ENGINE=InnoDB;
```

### 4.8 ສິ່ງທີ່ສະແດງໃຫ້ຜູ້ໃຊ້ເຫັນ

```
📍 ຕຳແໜ່ງຂອງທ່ານ: ໃກ້ຕະຫຼາດເຊົ້າ, ຫຼວງພະບາງ

   ຫ່າງຈາກຕາດກວາງຊີ   31.2 ກມ
   ເວລາເດີນທາງ         ປະມານ 50 ນາທີ (ລົດ)

   [ ເປີດເສັ້ນທາງໃນ Google Maps ]   [ ຈອງປີ້ເລີຍ ]
```

**ຈຳແນກລະດັບໄກ-ໃກ້** ໃຫ້ຜູ້ໃຊ້ຕັດສິນໃຈໄດ້ໄວ:

| ໄລຍະ | ປ້າຍ | ຄຳແນະນຳທີ່ສະແດງ |
|---|---|---|
| < 5 ກມ | ໃກ້ຫຼາຍ | ປັ່ນລົດຖີບ ຫຼື ຕຸກຕຸກກໍ່ໄປໄດ້ |
| 5–50 ກມ | ໃກ້ | ໄປກັບໄດ້ໃນວັນດຽວ |
| 50–200 ກມ | ປານກາງ | ແນະນຳອອກເດີນທາງເຊົ້າ |
| > 200 ກມ | ໄກ | ແນະນຳພັກຄືນໃນຫຼວງພະບາງ |

### 4.9 Deep link ໄປແອັບແຜນທີ່

```ts
export function mapsDirectionsUrl(from: LatLng) {
  const d = `${KUANGSI.lat},${KUANGSI.lng}`;
  const o = `${from.lat},${from.lng}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`,
    apple:  `https://maps.apple.com/?saddr=${o}&daddr=${d}&dirflg=d`,
  };
}
```

### 4.10 ກໍລະນີທີ່ຕ້ອງຈັດການ (Edge cases)

- [ ] ຜູ້ໃຊ້ **ປະຕິເສດ** ການແບ່ງປັນຕຳແໜ່ງ → ສະແດງ dropdown ໃຫ້ເລືອກບ່ອນພັກເອງ
- [ ] ຜູ້ໃຊ້ຢູ່ **ຕ່າງປະເທດ** (ຈອງລ່ວງໜ້າ) → ສະແດງໄລຍະຈາກ **ຕົວເມືອງຫຼວງພະບາງ** ແທນ
      ⚠️ ຫ້າມ hardcode ຕົວເລກ: 29 ກມ ແມ່ນໄລຍະຈາກ *ຕົວເມືອງ* ບໍ່ແມ່ນຈາກສະໜາມບິນ
      (ສະໜາມບິນຢູ່ທາງເໜືອຂອງເມືອງ ຈຶ່ງໄກກວ່ານັ້ນ) — ຄຳນວນດ້ວຍ routing API
- [ ] ສັນຍານ GPS **ບໍ່ແມ່ນຍຳ** (accuracy > 1000 ມ) → ແຈ້ງວ່າເປັນຕົວເລກປະມານ
- [ ] ບໍ່ມີອິນເຕີເນັດ → ໃຊ້ Haversine ຢ່າງດຽວ ພ້ອມປ້າຍ "ເສັ້ນຊື່"
- [ ] ຜູ້ໃຊ້ **ຢູ່ໃນພື້ນທີ່ຕາດແລ້ວ** (< 1 ກມ) → ປ່ຽນໄປສະແດງແຜນທີ່ພາຍໃນ + ປຸ່ມສະແກນປີ້ເຂົ້າ
- [ ] HTTP (ບໍ່ແມ່ນ HTTPS) → Geolocation API ຈະບໍ່ທຳງານ ຕ້ອງ deploy ດ້ວຍ HTTPS

### 4.11 ຄວາມເປັນສ່ວນຕົວ (ສຳຄັນ)

- ຂໍສິດທິ **ຕອນຜູ້ໃຊ້ກົດປຸ່ມ** ເທົ່ານັ້ນ ຢ່າຂໍທັນທີທີ່ເປີດໜ້າ
- ອະທິບາຍເຫດຜົນກ່ອນຂໍ: *"ເພື່ອຄຳນວນໄລຍະທາງ ແລະ ເວລາເດີນທາງໃຫ້ທ່ານ"*
- **ຢ່າເກັບ** ພິກັດແທ້ຂອງຜູ້ໃຊ້ໄວ້ໃນຖານຂໍ້ມູນ — ເກັບພຽງໄລຍະທາງ ຫຼື ຊື່ເມືອງ ຖ້າຕ້ອງການສຳລັບລາຍງານ
- ບອກໃນນະໂຍບາຍຄວາມເປັນສ່ວນຕົວວ່າໃຊ້ຕຳແໜ່ງເຮັດຫຍັງ


---

## 5. ຂໍ້ຕົກລົງສຳລັບເວີຊັນ 1 (ຕັດສິນແລ້ວ)

ລາຍລະອຽດຢູ່ໃນ `CLAUDE.md` ພາກ 7. ສະຫຼຸບ:

- ລາຄາເປັນ **ກີບຢ່າງດຽວ** — ສະກຸນອື່ນແປງຜ່ານ `exchange_rates`
- **1 QR ຕໍ່ 1 ການຈອງ** ບໍ່ແມ່ນຕໍ່ຄົນ
- ຈອງແບບ **guest** ບໍ່ມີການສະໝັກສະມາຊິກ
- ຈ່າຍເງິນ: **ເງິນສົດ + ອັບໂຫຼດຫຼັກຖານໂອນ** (ພະນັກງານອະນຸມັດ) — gateway ແທ້ເຮັດພາຍຫຼັງ
- **ຮອບເວລາປິດໄວ້ກ່ອນ** ໃນ v1 (ຕາຕະລາງມີແລ້ວ ແຕ່ຈອງເປັນວັນ)
- ບໍລິສັດທັດສະນາຈອນ: ໝາຍແຕ່ `channel` ຍັງບໍ່ມີບັນຊີ login ຂອງຕົນເອງ
- `id_number` ບໍ່ບັງຄັບ ແລະ **ບໍ່ສະແດງໃນລາຍງານ**
