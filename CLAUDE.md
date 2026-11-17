# CLAUDE.md — ລະບົບຈອງປີ້ຕາດກວາງຊີ

ໄຟລ໌ນີ້ແມ່ນກົດລະບຽບສຳລັບ AI coding agent. ອ່ານໄຟລ໌ນີ້ ແລະ `docs/requirements.md` ກ່ອນເຮັດວຽກທຸກຄັ້ງ.
ວຽກ UI ໃຫ້ອ່ານ `docs/ui-brief.md` ນຳ.

---

## 1. ກົດເຫຼັກ 4 ຂໍ້ (ສຳຄັນສຸດ)

1. **ຂຽນແຜນກ່ອນ ຂຽນ code ທີຫຼັງ** — ສະເໜີແຜນໃຫ້ຜູ້ໃຊ້ອະນຸມັດກ່ອນສ້າງ/ແກ້ໄຟລ໌ ທຸກຄັ້ງທີ່ເປັນວຽກໃຫຍ່
2. **ເຮັດ 1 phase ຕໍ່ 1 ຄັ້ງ ແລ້ວຢຸດລາຍງານ** — ຫ້າມເຮັດ phase ຕໍ່ໄປເອງ
3. **ອອກແບບ UI ກ່ອນ** — ຫ້າມຂຽນ code UI ແມ່ນແຕ່ແຖວດຽວ ກ່ອນແຜນ UI ຖືກອະນຸມັດ
4. **ບໍ່ແນ່ໃຈ → ຖາມ ຫ້າມເດົາ** — ສະເພາະເລື່ອງລາຄາ, ກົດລະບຽບທຸລະກິດ, payment gateway

---

## 2. Tech Stack (ຕາຍຕົວ ຫ້າມປ່ຽນໂດຍບໍ່ຖາມ)

| ສ່ວນ | ເຄື່ອງມື |
|---|---|
| Framework | Next.js 16 (App Router) — `proxy.ts` ແທນ `middleware.ts`, `params` ຕ້ອງ `await` |
| ພາສາ | TypeScript — `strict: true` |
| ຖານຂໍ້ມູນ | MySQL 8.0+ (ຈັດການຜ່ານ MySQL Workbench) |
| ORM | Prisma (`provider = "mysql"`) |
| CSS | Tailwind CSS |
| Component | shadcn/ui |
| Form | react-hook-form + zod |
| Auth | Auth.js (NextAuth v5) |
| ແຜນທີ່ | Leaflet + OpenStreetMap (ຕອນພັດທະນາ) |
| Routing | OpenRouteService ຕອນພັດທະນາ → Google Routes ຕອນໃຊ້ຈິງ (ອອກແບບເປັນ interface ດຽວ) |

```
DATABASE_URL="mysql://root:<ລະຫັດ>@localhost:3306/kuangsi"
```

- ລະຫັດແທ້ຢູ່ໃນ `.env` ເທົ່ານັ້ນ — `.env` ຕ້ອງຢູ່ໃນ `.gitignore`
- ແມ່ແບບຢູ່ໃນ `.env.example` (ບໍ່ມີລະຫັດ)

---

## 3. ລຳດັບ Phase

ເຮັດຕາມລຳດັບນີ້ ຫ້າມຂ້າມ:

- [ ] **Phase 1** — schema + migration + seed (run `db/kuangsi-schema.sql` ແລ້ວ `npx prisma db pull`)
- [ ] **Phase 2** — **ແຜນອອກແບບ UI/UX** — ເອກະສານເທົ່ານັ້ນ ຫ້າມຂຽນ code (ອ່ານ `docs/ui-brief.md` ສົ່ງເປັນ `docs/ui-plan.md`)
  ຕ້ອງມີ: ລາຍການໜ້າ+route, user flow, wireframe ASCII,
  ສີ/ຕົວອັກສອນ, ບັນຊີ component, ແລະ 5 ສະຖານະຂອງທຸກໜ້າ
  (loading / ວ່າງເປົ່າ / error / success / ຂັດຂ້ອງ)
- [ ] **Phase 3** — Auth + 4 ບົດບາດ (admin / ຂາຍປີ້ / ກວດປີ້ / ລາຍງານ)
- [ ] **Phase 4** — API ຈອງປີ້ (ຍັງບໍ່ມີ UI, ທົດສອບດ້ວຍ REST client)
- [ ] **Phase 5** — UI ຈອງປີ້ສຳລັບລູກຄ້າ
- [ ] **Phase 6** — ການຈ່າຍເງິນ (mock provider ກ່ອນ)
- [ ] **Phase 7** — QR code + ໜ້າສະແກນປີ້ເຂົ້າ
- [ ] **Phase 8** — ຟັງຊັນໄລຍະທາງ + ແຜນທີ່
- [ ] **Phase 9** — Admin dashboard + ລາຍງານ

**ກົດ**: schema → ແຜນ UI → API → UI code.
- ຫ້າມສ້າງ UI ກ່ອນ API ສຳເລັດ
- **ຫ້າມຂຽນ code UI ແມ່ນແຕ່ແຖວດຽວ ກ່ອນແຜນ Phase 2 ຖືກອະນຸມັດ**

---

## 4. ຂໍ້ຫ້າມ

- ຫ້າມ `npm install` package ນອກ stack ຂ້າງເທິງ ໂດຍບໍ່ຖາມກ່ອນ
- ຫ້າມແກ້ schema ຫຼັງຈາກຜູ້ໃຊ້ອະນຸມັດແລ້ວ — ຖ້າຕ້ອງແກ້ ຕ້ອງຖາມ ແລະ ອະທິບາຍເຫດຜົນ
- ຫ້າມໃຊ້ `prisma migrate` ແກ້ໂຄງສ້າງ — ແຫຼ່ງຄວາມຈິງແມ່ນ `db/kuangsi-schema.sql` ແກ້ SQL ແລ້ວ `prisma db pull`
- ຫ້າມຂຽນ `prisma/schema.prisma` ດ້ວຍມື
- ຫ້າມສ້າງໄຟລ໌ທີ່ບໍ່ຢູ່ໃນແຜນທີ່ອະນຸມັດແລ້ວ
- ຫ້າມເພີ່ມ feature ທີ່ບໍ່ໄດ້ສັ່ງ (ບໍ່ຕ້ອງ "ແຖມ" ໃຫ້)
- ຫ້າມສ້າງ API key, endpoint, ຫຼື ລາຄາ ຂຶ້ນມາເອງ — ໃຊ້ `.env.example` + `// TODO:`
- ຫ້າມຂຽນ comment ອະທິບາຍສິ່ງທີ່ code ບອກຢູ່ແລ້ວ
- ຫ້າມ `git commit` ຫຼື `git push` ໂດຍບໍ່ໄດ້ສັ່ງ
- ຫ້າມຂຽນລະຫັດຜ່ານ ຫຼື API key ລົງໃນ code — ໃສ່ `.env` ແລະ ຕ້ອງມີ `.env` ຢູ່ໃນ `.gitignore`
- ຂໍ້ຄວາມລາວໃຊ້ `line-height: 1.8` — ຫ້າມຕ່ຳກວ່າ 1.7 (ວັນນະຍຸດຈະຖືກຕັດ)
- ຫ້າມ `text-align: justify` (ພາສາລາວບໍ່ມີຍະຫວ່າງລະຫວ່າງຄຳ)
- ຫ້າມ hardcode ຂໍ້ຄວາມ UI ໃນ component — ວາງໄວ້ໃນໄຟລ໌ແປພາສາ

---

## 5. ນິຍາມຂອງ "ສຳເລັດ" (Definition of Done)

ແຕ່ລະ phase ຖືວ່າສຳເລັດເມື່ອ **ທັງ 5 ຂໍ້ຜ່ານ**:

1. `npm run build` ຜ່ານ ບໍ່ມີ error
2. `npx tsc --noEmit` ບໍ່ມີ type error
3. ມີ seed data ພໍໃຫ້ທົດລອງໄດ້
4. ທົດລອງ flow ຫຼັກຂອງ phase ນັ້ນໄດ້ຈິງໃນ browser ຫຼື REST client
5. ລາຍງານໃຫ້ຜູ້ໃຊ້ວ່າ: ເຮັດຫຍັງແລ້ວ · ໄຟລ໌ໃດຖືກແຕະ · ຍັງຄ້າງຫຍັງ · ຕ້ອງການຕັດສິນໃຈຫຍັງ

---

## 6. ມາດຕະຖານ Code

- ຊື່ຕາຕະລາງ: `snake_case` ແລະ ເປັນພະຫຸພົດ (`ticket_types`, `bookings`)
- ຊື່ field ໃນ TypeScript: `camelCase`
- ຊື່ component: `PascalCase`
- ໄຟລ໌ intercept request: `proxy.ts` (ຫ້າມໃຊ້ `middleware.ts` — ເລີກໃຊ້ແລ້ວໃນ Next 16)
- ຂໍ້ຄວາມທີ່ຜູ້ໃຊ້ເຫັນ: ວາງໄວ້ໃນໄຟລ໌ແປພາສາ ຫ້າມ hardcode ໃນ component
- ເງິນ: `DECIMAL(12,2)` ໃນ DB / `Decimal` ໃນ Prisma — ຫ້າມ `FLOAT`, `DOUBLE` ຫຼື `Float`
- ວັນເວລາ: ເກັບເປັນ UTC ແປງເປັນ `Asia/Vientiane` ຕອນສະແດງ
- ເຂດເວລາ: ທຸກ connection ໄປ MySQL ຕ້ອງເປັນ UTC (session `time_zone = '+00:00'`)
  - app: `lib/db.ts` ຕັ້ງ `timezone: "Z"` — ຫ້າມລຶບ ແລະ ຫ້າມສ້າງ `PrismaClient` ນອກ `lib/db.ts`
  - SQL file / Workbench / CLI / script: ແຖວທຳອິດຕ້ອງເປັນ `SET time_zone = '+00:00';`
  - **ຫ້າມປ່ຽນ global `time_zone` ຂອງ MySQL server** — ກະທົບ database ອື່ນໃນເຄື່ອງ ແລະ server ຕອນ deploy ຈະບໍ່ມີການຕັ້ງຄ່ານັ້ນ
  - ເຫດຜົນ: MySQL ໃນເຄື່ອງເປັນ +07 → `CURRENT_TIMESTAMP` / `ON UPDATE` ຈະຜິດ 7 ຊມ
- ທຸກ API route ຕ້ອງ validate input ດ້ວຍ zod
- ຖານຂໍ້ມູນຕ້ອງເປັນ `utf8mb4` / `utf8mb4_unicode_ci` — ບໍ່ດັ່ງນັ້ນພາສາລາວຈະເພ້ຍນ

---

## 7. ຂໍ້ຕົກລົງ (ຫ້າມຖາມຄືນ ຫ້າມປ່ຽນເອງ)

1.  ລາຄາເປັນກີບຢ່າງດຽວ ແປງສະກຸນອື່ນຜ່ານ exchange_rates
2.  1 QR ຕໍ່ 1 ການຈອງ (ກຸ່ມເຂົ້າພ້ອມກັນ) ບໍ່ມີຕາຕະລາງ tickets ຕໍ່ຄົນ
3.  4 ພາສາ ໃຊ້ຄໍລຳ name_lo / name_en / name_zh / name_th
4.  ເບີໂທຊ້ຳ → ໃຊ້ລູກຄ້າເກົ່າ ບໍ່ສ້າງ record ໃໝ່
5.  id_number ບໍ່ບັງຄັບ ແລະ ຫ້າມສະແດງໃນລາຍງານ ຫຼື export
6.  ບໍລິສັດທັດສະນາຈອນ: ໃຊ້ແຕ່ bookings.channel ຍັງບໍ່ມີຕາຕະລາງ agencies
7.  route_cache ປັດພິກັດເຫຼືອ 2 ທົດສະນິຍົມ (~1 ກມ) ຫ້າມເກັບພິກັດແທ້ຂອງຜູ້ໃຊ້
8.  ຫ້າມ hardcode ໄລຍະທາງ — 29 ກມ ແມ່ນຈາກຕົວເມືອງ ບໍ່ແມ່ນສະໜາມບິນ
    ໃຫ້ຄຳນວນດ້ວຍ routing API
9.  ປີ້ pending ໝົດອາຍຸ 30 ນາທີ — ອ່ານຈາກ settings ຫ້າມ hardcode
10. ຈ່າຍເງິນ v1 = ເງິນສົດ + ອັບໂຫຼດຫຼັກຖານໂອນ → ພະນັກງານອະນຸມັດ
11. ໃຊ້ງານຈິງ ບໍ່ແມ່ນໂປຣເຈັກຮຽນ → MySQL ບໍ່ແມ່ນ SQLite (PDF ໃນໂຟນເດີບໍ່ກ່ຽວ)
12. ຈອງແບບ guest ບໍ່ມີການສະໝັກສະມາຊິກ ຄົ້ນຫາດ້ວຍລະຫັດຈອງ + ເບີໂທ
13. ມີຕາຕະລາງ time_slots ແຕ່ປິດໄວ້ກ່ອນໃນ v1 (ຈອງເປັນວັນ)
14. ຈອງ online ຈ່າຍໄດ້ແຕ່ການໂອນ (ອັບໂຫຼດຫຼັກຖານ) — ເງິນສົດມີແຕ່ຢູ່ POS
    UI ຝັ່ງ online ຫ້າມສະແດງຕົວເລືອກ "ຈ່າຍໜ້າງານ" / "ເງິນສົດ" ເລີຍ
    ອະນຸຍາດແຕ່ຂໍ້ຄວາມຂໍ້ມູນນ້ອຍໃຕ້ຄຳອະທິບາຍການໂອນ: "ໂອນບໍ່ໄດ້? ຊື້ປີ້ໄດ້ທີ່ປະຕູທາງເຂົ້າໂດຍກົງ"
    — ເປັນຂໍ້ຄວາມທຳມະດາ ຫ້າມເປັນ radio / checkbox / ປຸ່ມ / ລິ້ງ ທີ່ສ້າງການຈອງໄດ້
15. ອັບໂຫຼດຫຼັກຖານສຳເລັດ → bookings.status = 'verifying' ແລະ expires_at = NULL (ໂມງຢຸດ)
    ຫ້າມປ່ອຍໃຫ້ໝົດອາຍຸລະຫວ່າງພະນັກງານກວດ
    ພະນັກງານປະຕິເສດ → ກັບເປັນ 'pending' ແລະ ຕັ້ງ expires_at ໃໝ່ຕາມ settings.booking_hold_minutes
16. bookings.customer_id ເປັນ NULL ໄດ້ — ການຂາຍໜ້າປະຕູບໍ່ມີລູກຄ້າແທ້
    ຫ້າມໃຊ້ record "ລູກຄ້າໜ້າປະຕູ" ຮ່ວມກັນ (ລາຍງານຈະນັບຈຳນວນລູກຄ້າຜິດ)
    ຖ້າພະນັກງານໃສ່ຊື່/ເບີໃຫ້ → ສ້າງ ຫຼື ໃຊ້ customer record ຕາມປົກກະຕິ (ຂໍ້ 4)
17. ປີ້ POS ຍັງຕ້ອງສະແກນຢູ່ປະຕູ (ຄ່າເລີ່ມຕົ້ນ)
    settings.pos_auto_checkin = 'false' — ປ່ຽນເປັນ 'true' ໄດ້ໂດຍບໍ່ແກ້ code
    ຖ້າປະຕູກັບບ່ອນຂາຍເປັນບ່ອນດຽວກັນ (TODO: ຢືນຢັນຜັງພື້ນທີ່ກັບຜູ້ຈັດການຕາດ)
18. check_ins.result ມີ 'unpaid' ແລະ 'cancelled' ນຳ — ທຸກການປະຕິເສດຢູ່ປະຕູຕ້ອງບັນທຶກເຫດຜົນ
19. ໜ້າ /[lang]/booking/[code] ມີຊື່ + ເບີໂທ → ເປີດໄດ້ສະເພາະ: browser ທີ່ຫາກໍຈອງ (cookie)
    ຫຼື ຜ່ານໜ້າຄົ້ນຫາ (ລະຫັດຈອງ + ເບີໂທ) · ລິ້ງໃນອີເມວໃຊ້ qr_token ບໍ່ແມ່ນ booking_code
20. ການກວດຫຼັກຖານໂອນ ບັນທຶກໃນແຖວ payments ໂດຍກົງ (audit_logs ຢ່າງດຽວບໍ່ພໍ — ເລື່ອງເງິນ)
    ອະນຸມັດ → payments.status = 'success', paid_at, verified_by, verified_at
    ປະຕິເສດ → payments.status = 'failed', reject_reason (ບັງຄັບ), verified_by, verified_at
    reject_reason ແມ່ນຂໍ້ຄວາມທີ່ລູກຄ້າເຫັນ — ຫ້າມໃຊ້ bookings.note ຫຼື refund_reason ແທນ
    ອັບໂຫຼດໃໝ່ຫຼັງຖືກປະຕິເສດ → ສ້າງແຖວ payments ໃໝ່ (ເກັບປະຫວັດແຖວເກົ່າໄວ້)
    payments.verified_by → users ເປັນ RESTRICT: ຫ້າມລຶບ user ທີ່ເຄີຍກວດເງິນ ໃຫ້ປິດດ້ວຍ is_active

## 7b. ຂໍ້ມູນທີ່ຍັງບໍ່ຢືນຢັນ — ໃຊ້ placeholder ແລະ ໝາຍ TODO

| ລາຍການ | ສະຖານະ |
|---|---|
| ລາຄາປີ້ແທ້ (ຄົນລາວ / ຕ່າງປະເທດ) | ❓ ລໍຢືນຢັນ — seed ມີຕົວເລກຕົວຢ່າງແລ້ວ |
| ອາຍຸເດັກເຂົ້າຟຣີ | ❓ ລໍຢືນຢັນ |
| API ຂອງ BCEL One / OnePay | ❓ ຍັງບໍ່ມີເອກະສານ |
| ຈຳນວນຄົນສູງສຸດຕໍ່ວັນ | ❓ ລໍຢືນຢັນ |
| ນະໂຍບາຍຄືນເງິນ | ❓ ລໍຢືນຢັນ — seed ໃສ່ 24ຊມ/12ຊມ ໄວ້ |

ທຸກລາຍການຂ້າງເທິງ: ຕ້ອງແກ້ໄດ້ຈາກໜ້າ settings ຫ້າມ hardcode ໃນ code

---

## 8. ພິກັດຄົງທີ່

```ts
// ຕາດກວາງຊີ — ຫ່າງຈາກເມືອງຫຼວງພະບາງ ປະມານ 29 ກມ ທາງທິດໃຕ້
export const KUANGSI = { lat: 19.74917, lng: 101.99167 } as const;
```

---

## 9. ຮູບແບບການລາຍງານຕອນຈົບແຕ່ລະ phase

```
## Phase N ສຳເລັດ

ເຮັດຫຍັງແລ້ວ:
- ...

ໄຟລ໌ທີ່ສ້າງ/ແກ້:
- ...

ວິທີທົດລອງ:
- ...

ຕ້ອງການໃຫ້ຜູ້ໃຊ້ຕັດສິນໃຈ:
- ...

ຢຸດລໍຄຳສັ່ງ.
```
