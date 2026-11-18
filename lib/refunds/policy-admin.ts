import { z } from "zod";
import { writeAudit, type Actor } from "@/lib/admin/audit";
import { confirmRequired } from "@/lib/admin/settings";
import { prisma } from "@/lib/db";
import { loadPolicy } from "@/lib/refunds/cancel";
import type { PolicyTier } from "@/lib/refunds/policy";

// ຂໍ້ຕົກລົງ 53: ແກ້ນະໂຍບາຍຈາກໜ້າ settings · ກະທົບເງິນ → ຢືນຢັນເກົ່າ-ໃໝ່ທຸກຄັ້ງ · ມີຜົນກັບການຍົກເລີກຫຼັງບັນທຶກເທົ່ານັ້ນ
export const policySchema = z.object({
  tiers: z
    .array(z.object({ hoursBefore: z.number().int().min(1).max(8760), refundPercent: z.number().int().min(0).max(100) }))
    .max(10)
    .refine((t) => new Set(t.map((x) => x.hoursBefore)).size === t.length, { message: "duplicate_hours" }),
  confirm: z.boolean().optional(),
});

const text = (tiers: PolicyTier[]) =>
  [...tiers].sort((a, b) => b.hoursBefore - a.hoursBefore).map((t) => `${t.hoursBefore}h→${t.refundPercent}%`).join(" · ") || "—";

export async function savePolicy(input: z.infer<typeof policySchema>, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM refund_policies FOR UPDATE`;
    const before = await loadPolicy(tx);
    if (text(before) === text(input.tiers)) return { changed: 0 };
    if (!input.confirm) confirmRequired({ changes: [{ key: "refund_policies", old: text(before), new: text(input.tiers) }] });
    await tx.refund_policies.deleteMany({});
    if (input.tiers.length) {
      await tx.refund_policies.createMany({ data: input.tiers.map((t) => ({ hours_before: t.hoursBefore, refund_percent: t.refundPercent, updated_by: actor.id })) });
    }
    await writeAudit(tx, actor, { action: "refund_policy.update", table: "refund_policies", oldValue: { tiers: before }, newValue: { tiers: input.tiers } });
    return { changed: 1 };
  });
}
