# ລະບົບຈອງປີ້ຕາດກວາງຊີ

ລະບົບຂາຍ ແລະ ກວດປີ້ເຂົ້າຊົມ **ຕາດກວາງຊີ** (ຫຼວງພະບາງ) — ໃຊ້ງານຈິງ ບໍ່ແມ່ນໂປຣເຈັກຮຽນ.

## ເຮັດຫຍັງໄດ້

- **ລູກຄ້າ** (4 ພາສາ: ລາວ · ອັງກິດ · ຈີນ · ໄທ): ຈອງ online ແບບ guest · ໂອນເງິນແລ້ວອັບໂຫຼດຫຼັກຖານ · ຮັບ QR (ເປີດໄດ້ຕອນ offline) · ຄົ້ນຫາການຈອງດ້ວຍລະຫັດ + ເບີໂທ · ໄລຍະທາງ + ລິ້ງນຳທາງ · ຍົກເລີກ ແລະ ຂໍຄືນເງິນຕາມນະໂຍບາຍ
- **ແຄຊຽ** (`cashier`): ຂາຍປີ້ໜ້າປະຕູ (POS ເງິນສົດ) · ກວດ ແລະ ອະນຸມັດຫຼັກຖານໂອນ · ຍົກເລີກການຂາຍ POS · ຄິວຄືນເງິນ
- **ພະນັກງານສະແກນ** (`scanner`): ສະແກນ QR ດ້ວຍກ້ອງ · ສະແດງປະເພດປີ້ (ລາວ/ຕ່າງປະເທດ × ອາຍຸ) · ສະແກນ offline ແລ້ວ sync ໄດ້
- **admin / ລາຍງານ** (`admin` / `viewer`): dashboard (ຮັບເງິນ · ຄືນເງິນ · ສຸດທິ) · ລາຍງານ · ຈັດການຜູ້ໃຊ້ · ລາຄາ ແລະ ປະເພດປີ້ · ວັນປິດ · ອັດຕາແລກປ່ຽນ · ນະໂຍບາຍຄືນເງິນ · ຕັ້ງຄ່າອື່ນໆ

## Stack

Next.js 16 (App Router) · TypeScript (strict) · MySQL 8 · Prisma · Tailwind CSS · shadcn/ui · react-hook-form + zod · Auth.js v5 · `qr` · Playwright (e2e)

ລາຍລະອຽດ ແລະ ກົດລະບຽບ: `CLAUDE.md` ພາກ 2

## ແລ່ນໃນເຄື່ອງ

ຕ້ອງມີ: Node 26 · MySQL 8.0+ · Google Chrome (ສຳລັບ e2e)

```bash
git clone <repo-url> kuangsi
cd kuangsi
npm ci

# 1. ຕັ້ງຄ່າ — ໃສ່ລະຫັດ MySQL ແລະ AUTH_SECRET (openssl rand -base64 33)
cp .env.example .env

# 2. ສ້າງຖານຂໍ້ມູນ + seed (ຫຼື ເປີດໄຟລ໌ໃນ MySQL Workbench ແລ້ວກົດ Execute)
mysql -u root -p < db/kuangsi-schema.sql

# 3. ສ້າງ Prisma client (lib/generated ບໍ່ຢູ່ໃນ git)
npx prisma generate --config prisma7.config.ts

# 4. ຕັ້ງລະຫັດ admin (ພິມລະຫັດຜ່ານຕອນຖືກຖາມ)
npm run user:upsert -- --username admin --role admin

# 5. ແລ່ນ
npm run dev
```

ເປີດ http://localhost:3000 · ໜ້າພະນັກງານ login ທີ່ http://localhost:3000/staff/login

ການຈອງ online ຈະປິດຢູ່ ຈົນກວ່າ admin ໃສ່ບັນຊີທະນາຄານ + ເວລາກວດຫຼັກຖານຄົບ 4 ພາສາ ໃນໜ້າ settings (ຂໍ້ຕົກລົງ 28).

## ເອກະສານ

| ໄຟລ໌ | ເນື້ອໃນ |
|---|---|
| `CLAUDE.md` | ກົດລະບຽບ · stack · ລຳດັບ phase · ຂໍ້ຕົກລົງທັງໝົດ (ອ່ານກ່ອນແກ້ code) |
| `docs/requirements.md` | ຄວາມຕ້ອງການຂອງລະບົບ |
| `docs/ui-plan.md` | ແຜນ UI/UX: ໜ້າ · flow · wireframe · ສະຖານະ |
| `docs/deploy.md` | ຄູ່ມື deploy ຂຶ້ນ server · backup · rollback · checklist ກ່ອນເປີດ |
| `db/kuangsi-schema.sql` | ໂຄງສ້າງ DB + seed — ແຫຼ່ງຄວາມຈິງ (ແກ້ SQL ແລ້ວ `prisma db pull` · ຫ້າມ `prisma migrate`) |

## ຄຳສັ່ງທີ່ໃຊ້ເລື້ອຍ

| ຄຳສັ່ງ | ໃຊ້ເຮັດຫຍັງ |
|---|---|
| `npm run dev` | ແລ່ນເຄື່ອງພັດທະນາ |
| `npm run build` | build ສຳລັບ production |
| `npx tsc --noEmit` | ກວດ type |
| `npm test` | unit test (`lib/**/*.test.ts`) |
| `npm run test:e2e` | e2e ດ້ວຍ Playwright — ຕ້ອງ `npm run build` ກ່ອນ · ໃຊ້ DB ເຄື່ອງພັດທະນາ |
| `npm run user:upsert -- --username <ຊື່> --role <admin\|cashier\|scanner\|viewer>` | ສ້າງ/ຕັ້ງລະຫັດໃໝ່ໃຫ້ພະນັກງານ (ປົດລັອກນຳ) |
| `npm run places:routes` | ຄຳນວນໄລຍະທາງຈາກສະຖານທີ່ໄປຕາດ (ຕ້ອງມີ `ORS_API_KEY`) |
| `npm run refunds:purge` | ລ້າງເລກບັນຊີລູກຄ້າຂອງການຄືນເງິນທີ່ຄ້າງເກີນກຳນົດ (cron ລາຍວັນຢູ່ server) |

## ສະຖານະ

Phase 1–11 ສຳເລັດ · Phase 12a (ໄຟລ໌ deploy + `docs/deploy.md`) ສຳເລັດ.
**ພ້ອມ deploy — ລໍ server (VPS + ໂດເມນ)** ແລະ ຂໍ້ມູນຈາກຜູ້ຈັດການຕາດ (ລາຄາປີ້ · ອາຍຸເດັກ · ບັນຊີທະນາຄານ).
ລາຍການທີ່ເຫຼືອທັງໝົດ: `docs/deploy.md` ພາກ 13.
