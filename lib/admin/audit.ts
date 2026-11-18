import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/settings";

export type Actor = { id: bigint; ip: string | null };

type Entry = {
  action: string;
  table: string;
  recordId?: bigint | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

// 10b: ທຸກການແກ້ໄຂ → audit_logs ພ້ອມຄ່າເກົ່າ-ໃໝ່ (ຫ້າມໃສ່ password / hash)
export async function writeAudit(tx: Db, actor: Actor, e: Entry) {
  await tx.audit_logs.create({
    data: {
      user_id: actor.id,
      action: e.action,
      table_name: e.table,
      record_id: e.recordId ?? null,
      old_value: e.oldValue ?? Prisma.DbNull,
      new_value: e.newValue ?? Prisma.DbNull,
      ip_address: actor.ip,
    },
  });
}

// ປະຫວັດການແກ້ໄຂ (ຄຳຖາມ B5) — ສະເພາະຕາຕະລາງທີ່ແກ້ຈາກໜ້າ admin (ບໍ່ດຶງ audit ຂອງການຈອງ/ການຈ່າຍ ທີ່ອາດມີຂໍ້ມູນລູກຄ້າ)
export const ADMIN_AUDIT_TABLES = ["settings", "operating_hours", "holidays", "daily_capacity", "exchange_rates", "places", "users"] as const;

export async function listAdminAudit(limit = 200) {
  const rows = await prisma.audit_logs.findMany({
    where: { table_name: { in: [...ADMIN_AUDIT_TABLES] } },
    orderBy: { id: "desc" },
    take: limit,
    select: { id: true, action: true, record_id: true, old_value: true, new_value: true, created_at: true, users: { select: { full_name: true } } },
  });
  return rows.map((r) => ({
    id: String(r.id),
    action: r.action,
    recordId: r.record_id === null ? null : String(r.record_id),
    oldValue: r.old_value as Record<string, unknown> | null,
    newValue: r.new_value as Record<string, unknown> | null,
    at: r.created_at.toISOString(),
    by: r.users?.full_name ?? null,
  }));
}

// "ແກ້ລ່າສຸດ: ໃຜ · ເວລາ" ຂອງແຕ່ລະ tab
export async function lastEdit(actions: string[]) {
  const row = await prisma.audit_logs.findFirst({
    where: { action: { in: actions } },
    orderBy: { id: "desc" },
    select: { created_at: true, users: { select: { full_name: true } } },
  });
  return row ? { by: row.users?.full_name ?? "—", at: row.created_at.toISOString() } : null;
}
