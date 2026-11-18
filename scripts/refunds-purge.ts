// ຂໍ້ຕົກລົງ 55: ລ້າງເລກບັນຊີລູກຄ້າ ຂອງການຄືນເງິນທີ່ຄ້າງ (requested) ເກີນ settings.refund_account_retention_days
//   npm run refunds:purge   ← ໃຫ້ cron ແລ່ນທຸກມື້ ຕອນ deploy (Phase 12) · ໜ້າ dashboard / ຄິວຄືນເງິນ ກໍລ້າງເອງທຸກຄັ້ງທີ່ເປີດ
import { prisma } from "@/lib/db";
import { purgeStaleRefundAccounts } from "@/lib/refunds/cancel";

async function main() {
  const n = await purgeStaleRefundAccounts();
  console.log(`purged: ${n} refund account number(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
