// ຂໍ້ຕົກລົງ 53/54: ນະໂຍບາຍຄືນເງິນເປັນຂັ້ນຈາກ refund_policies (ຫ້າມ hardcode) — ໃຊ້ໄດ້ທັງ server ແລະ client (ບໍ່ແຕະ DB)

export type PolicyTier = { hoursBefore: number; refundPercent: number };
export type RefundQuote = { hoursLeft: number; percent: number; tierHours: number | null; amount: number };

// ເວລາເປີດຂອງວັນເຂົ້າຊົມ (ເວລາລາວ — Asia/Vientiane ບໍ່ມີ DST ຈຶ່ງເປັນ +07:00 ສະເໝີ)
// ວັນທີ່ບໍ່ມີເວລາເປີດ (ປິດປະຈຳອາທິດ) → ນັບຈາກ 00:00 ຂອງວັນນັ້ນ
export function openingInstant(visitDate: string, openTime: string | null): Date {
  return new Date(`${visitDate}T${openTime ?? "00:00:00"}+07:00`);
}

export function hoursUntil(target: Date, now: Date): number {
  return (target.getTime() - now.getTime()) / 3_600_000;
}

// ຂັ້ນທີ່ hours_before ສູງສຸດ ທີ່ ≤ ຊົ່ວໂມງທີ່ເຫຼືອ · ບໍ່ເຂົ້າຂັ້ນໃດ = 0%
export function pickTier(tiers: PolicyTier[], hoursLeft: number): { percent: number; tierHours: number | null } {
  const tier = [...tiers].sort((a, b) => b.hoursBefore - a.hoursBefore).find((t) => hoursLeft >= t.hoursBefore);
  return tier ? { percent: tier.refundPercent, tierHours: tier.hoursBefore } : { percent: 0, tierHours: null };
}

// ປັດລົງເປັນກີບເຕັມ — ບໍ່ຄືນເກີນນະໂຍບາຍ ແລະ ບໍ່ເກີນຍອດທີ່ຈ່າຍ
export function refundAmount(paid: number, percent: number): number {
  return Math.min(paid, Math.floor((paid * percent) / 100));
}

export function quoteRefund(tiers: PolicyTier[], paid: number, visitDate: string, openTime: string | null, now: Date): RefundQuote {
  const hoursLeft = hoursUntil(openingInstant(visitDate, openTime), now);
  const { percent, tierHours } = pickTier(tiers, hoursLeft);
  return { hoursLeft, percent, tierHours, amount: refundAmount(paid, percent) };
}
