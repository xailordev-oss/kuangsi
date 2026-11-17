import { prisma } from "@/lib/db";
import { isoDateToDb, todayInVientiane } from "@/lib/time";

export const DISPLAY_CURRENCIES = ["USD", "THB"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

// ກີບຕໍ່ 1 ໜ່ວຍຂອງສະກຸນເງິນ ຈາກອັດຕາລ່າສຸດທີ່ມີຜົນແລ້ວ (ຂໍ້ຕົກລົງ 30)
// ຮັບທັງ USD→LAK ແລະ LAK→USD · ບໍ່ມີໃນລະບົບ → ບໍ່ສົ່ງຄືນ (ຫ້າມຄິດເອງ ຫຼື ດຶງຈາກພາຍນອກ)
export async function getLakPerUnit(): Promise<Partial<Record<DisplayCurrency, number>>> {
  const today = isoDateToDb(todayInVientiane());
  const rows = await prisma.exchange_rates.findMany({
    where: {
      effective_date: { lte: today },
      OR: [
        { from_currency: { in: [...DISPLAY_CURRENCIES] }, to_currency: "LAK" },
        { from_currency: "LAK", to_currency: { in: [...DISPLAY_CURRENCIES] } },
      ],
    },
    orderBy: { effective_date: "desc" },
  });

  const result: Partial<Record<DisplayCurrency, number>> = {};
  for (const currency of DISPLAY_CURRENCIES) {
    const row = rows.find((r) => r.from_currency === currency || r.to_currency === currency);
    if (!row || row.rate.lte(0)) continue;
    result[currency] = row.from_currency === "LAK" ? 1 / row.rate.toNumber() : row.rate.toNumber();
  }
  return result;
}
