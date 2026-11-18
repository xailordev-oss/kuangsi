import { z } from "zod";
import { writeAudit, type Actor } from "@/lib/admin/audit";
import { BusinessError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { quoteRefund, type PolicyTier, type RefundQuote } from "@/lib/refunds/policy";
import { getIntSetting, type Db } from "@/lib/settings";
import { dayOfWeek, dbDateToIso, dbTimeToString, isoDateToDb, todayInVientiane } from "@/lib/time";

// Phase 11 — ຂໍ້ຕົກລົງ 54–57
// ກັນຄືນຊ້ຳ: ລັອກແຖວ booking + payment ໃນ transaction · UNIQUE(refunds.payment_id) · CHECK ໃນ DB · ຂັ້ນ completed ເທື່ອດຽວ

export const bankSchema = z.object({
  bankName: z.string().trim().min(1).max(100),
  accountNumber: z.string().trim().regex(/^[0-9][0-9 -]{3,28}[0-9]$/),
  accountName: z.string().trim().min(1).max(150),
});
type Bank = z.infer<typeof bankSchema>;

export const customerCancelSchema = z.object({
  // ຈຳນວນທີ່ລູກຄ້າເຫັນ ແລະ ກົດຢືນຢັນ — % ປ່ຽນລະຫວ່າງນັ້ນ → 409 refund_changed
  expectedAmount: z.number().int().min(0),
  reason: z.string().trim().max(255).optional(),
  bank: bankSchema.optional(),
});

export const adminCancelSchema = z
  .object({
    mode: z.enum(["policy", "full", "custom"]),
    amount: z.number().int().min(0).optional(),
    expectedAmount: z.number().int().min(0).optional(),
    reason: z.string().trim().min(3).max(255),
    bank: bankSchema.optional(),
  })
  .refine((v) => v.mode !== "custom" || v.amount !== undefined, { message: "amount_required", path: ["amount"] });

export const posVoidSchema = z.object({ reason: z.string().trim().min(3).max(255) });
export const completeSchema = z.object({ transferRef: z.string().trim().max(100).optional() });

export async function loadPolicy(db: Db = prisma): Promise<PolicyTier[]> {
  const rows = await db.refund_policies.findMany({ orderBy: { hours_before: "desc" } });
  return rows.map((r) => ({ hoursBefore: r.hours_before, refundPercent: r.refund_percent }));
}

type Locked = { id: bigint; booking_code: string; status: string; channel: string; visit_date: Date; total_amount: Prisma.Decimal };
type PaidRow = { id: bigint; method: string; amount: Prisma.Decimal };

async function lockBooking(tx: Db, code: string) {
  const [b] = await tx.$queryRaw<Locked[]>`
    SELECT id, booking_code, status, channel, visit_date, total_amount FROM bookings WHERE booking_code = ${code} FOR UPDATE`;
  if (!b) throw new BusinessError(404, "not_found");
  const [paid] = await tx.$queryRaw<PaidRow[]>`
    SELECT id, method, amount FROM payments WHERE booking_id = ${b.id} AND status = 'success' ORDER BY id DESC LIMIT 1 FOR UPDATE`;
  return { b, paid: paid ?? null };
}

async function openTimeOf(db: Db, visitDate: string): Promise<string | null> {
  const h = await db.operating_hours.findUnique({ where: { day_of_week: dayOfWeek(visitDate) } });
  return h && !h.is_closed ? dbTimeToString(h.open_time) : null;
}

function assertCancellable(status: string) {
  if (status === "verifying") throw new BusinessError(409, "verifying");
  if (status !== "pending" && status !== "paid") throw new BusinessError(409, "not_cancellable", { status });
}

const last4 = (acct: string) => acct.replace(/\D/g, "").slice(-4);
const refundMethod = (paymentMethod: string) => (paymentMethod === "cash" ? "cash" : "bank_transfer") as "cash" | "bank_transfer";

export type CancelPreview =
  | { cancellable: false; reason: "verifying" | "not_cancellable" | "gate_sale" }
  | ({ cancellable: true; paid: number; method: "cash" | "bank_transfer" | null; tiers: PolicyTier[]; openTime: string | null } & RefundQuote);

// ໜ້າລູກຄ້າ: ສະແດງ % + ຈຳນວນທີ່ຈະໄດ້ຄືນ (server ຄິດຄືນຕອນກົດ — ຂໍ້ຕົກລົງ 54)
export async function cancelPreview(code: string, now = new Date(), opts: { staff?: boolean } = {}): Promise<CancelPreview> {
  const b = await prisma.bookings.findUnique({
    where: { booking_code: code },
    select: { id: true, status: true, channel: true, visit_date: true, payments: { where: { status: "success" }, orderBy: { id: "desc" }, take: 1 } },
  });
  if (!b) return { cancellable: false, reason: "not_cancellable" };
  if (b.channel !== "online" && !opts.staff) return { cancellable: false, reason: "gate_sale" };
  if (b.status === "verifying") return { cancellable: false, reason: "verifying" };
  if (b.status !== "pending" && b.status !== "paid") return { cancellable: false, reason: "not_cancellable" };
  const visitDate = dbDateToIso(b.visit_date);
  const [tiers, openTime] = await Promise.all([loadPolicy(), openTimeOf(prisma, visitDate)]);
  const pay = b.status === "paid" ? b.payments[0] : undefined;
  const paid = pay ? pay.amount.toNumber() : 0;
  return { cancellable: true, paid, method: pay ? refundMethod(pay.method) : null, tiers, openTime, ...quoteRefund(tiers, paid, visitDate, openTime, now) };
}

type CancelCore = {
  code: string;
  by: bigint | null; // null = ລູກຄ້າ
  ip: string | null;
  reason: string;
  decide: (ctx: { b: Locked; paid: PaidRow | null; quote: RefundQuote; tx: Db }) => { amount: number; percent: number; tierHours: number | null; mode: string };
  bank?: Bank;
  // ເງິນສົດຍື່ນຄືນທັນທີ (ລູກຄ້າຢູ່ຕໍ່ໜ້າ — POS) → completed ໃນຂັ້ນດຽວ
  // ບໍ່ດັ່ງນັ້ນ (admin ເລີ່ມຈາກບ່ອນອື່ນ) → requested "ລໍຄືນເງິນສົດ" ຈົນກວ່າຍື່ນເງິນແລ້ວກົດຢືນຢັນ (ຂໍ້ຕົກລົງ 60)
  staffHandsCash: boolean;
  requireBankForTransfer: boolean;
  extraCheck?: (b: Locked) => void;
};

async function cancelCore(o: CancelCore) {
  const result = await prisma.$transaction(async (tx) => {
    const { b, paid } = await lockBooking(tx, o.code);
    o.extraCheck?.(b);
    assertCancellable(b.status);
    const visitDate = dbDateToIso(b.visit_date);
    const quote = quoteRefund(await loadPolicy(tx), paid ? paid.amount.toNumber() : 0, visitDate, await openTimeOf(tx, visitDate), new Date());
    const d = paid ? o.decide({ b, paid, quote, tx }) : { amount: 0, percent: 0, tierHours: null, mode: "unpaid" };
    if (paid && d.amount > paid.amount.toNumber()) throw new BusinessError(422, "amount_exceeds_paid", { paid: paid.amount.toFixed(0) });

    const method = paid ? refundMethod(paid.method) : null;
    if (d.amount > 0 && method === "bank_transfer" && o.requireBankForTransfer && !o.bank) throw new BusinessError(422, "bank_required");

    const now = new Date();
    await tx.bookings.update({
      where: { id: b.id },
      data: { status: "cancelled", cancelled_at: now, cancelled_by: o.by, cancel_reason: o.reason, expires_at: null },
    });

    let refund: { id: string; amount: number; percent: number; status: "requested" | "completed"; method: "cash" | "bank_transfer" } | null = null;
    if (paid && d.amount > 0 && method) {
      const completeNow = method === "cash" && o.staffHandsCash;
      const r = await tx.refunds.create({
        data: {
          booking_id: b.id,
          payment_id: paid.id,
          amount: d.amount,
          refund_percent: d.percent,
          policy_hours: d.tierHours,
          method,
          status: completeNow ? "completed" : "requested",
          reason: o.reason,
          requested_by: o.by,
          ...(o.bank && method === "bank_transfer" && {
            bank_name: o.bank.bankName,
            account_number: o.bank.accountNumber,
            account_name: o.bank.accountName,
            account_last4: last4(o.bank.accountNumber),
          }),
          ...(completeNow && { completed_by: o.by, completed_at: now }),
        },
        select: { id: true },
      });
      // ຂໍ້ຕົກລົງ 44: ນັບເປັນເງິນຄືນ ຕອນເງິນອອກແທ້ເທົ່ານັ້ນ
      if (completeNow) {
        await tx.payments.update({ where: { id: paid.id }, data: { status: "refunded", refund_amount: d.amount, refund_reason: o.reason, refunded_at: now } });
      }
      refund = { id: String(r.id), amount: d.amount, percent: d.percent, status: completeNow ? "completed" : "requested", method };
    }

    await tx.audit_logs.create({
      data: {
        user_id: o.by,
        action: "booking.cancel",
        table_name: "bookings",
        record_id: b.id,
        old_value: { status: b.status },
        new_value: {
          status: "cancelled",
          by: o.by === null ? "customer" : "staff",
          mode: d.mode,
          reason: o.reason,
          paid: paid ? paid.amount.toFixed(0) : "0",
          percent: d.percent,
          refund: d.amount,
          refundStatus: refund?.status ?? null,
          // ຂໍ້ຕົກລົງ 55: audit ເກັບແຕ່ 4 ຕົວທ້າຍ
          accountLast4: o.bank ? last4(o.bank.accountNumber) : null,
        },
        ip_address: o.ip,
      },
    });
    return { bookingCode: b.booking_code, refund };
  });
  await purgeStaleRefundAccounts().catch(() => undefined);
  return result;
}

function refundChanged(expected: number, q: { amount: number; percent: number }): never {
  throw new BusinessError(409, "refund_changed", { expectedAmount: String(expected), amount: String(q.amount), percent: q.percent });
}

// ລູກຄ້າ: ການຈອງ online ຂອງຕົນ ຕາມນະໂຍບາຍເທົ່ານັ້ນ (ສິດກວດທີ່ route — ຂໍ້ຕົກລົງ 19)
export function cancelByCustomer(code: string, input: z.infer<typeof customerCancelSchema>, ip: string | null) {
  return cancelCore({
    code,
    by: null,
    ip,
    reason: input.reason || "customer_request",
    bank: input.bank,
    staffHandsCash: false,
    requireBankForTransfer: true,
    extraCheck: (b) => {
      if (b.channel !== "online") throw new BusinessError(409, "gate_sale");
    },
    decide: ({ quote }) => {
      if (quote.amount !== input.expectedAmount) refundChanged(input.expectedAmount, quote);
      return { amount: quote.amount, percent: quote.percent, tierHours: quote.tierHours, mode: "policy" };
    },
  });
}

// admin: ຕາມນະໂຍບາຍ / 100% (ເຊັ່ນ ຕາດປິດ) / ກຳນົດເອງ 0 → ຍອດທີ່ຈ່າຍ · ເຫດຜົນບັງຄັບ
// ຂໍ້ຕົກລົງ 60: admin ອາດບໍ່ໄດ້ຢູ່ໜ້າລູກຄ້າ (ເຊັ່ນ ທາງໂທລະສັບ) → ເງິນສົດເຂົ້າຄິວ "ລໍຄືນເງິນສົດ" ບໍ່ບັນທຶກວ່າຄືນແລ້ວ
export function cancelByAdmin(code: string, input: z.infer<typeof adminCancelSchema>, actor: Actor) {
  return cancelCore({
    code,
    by: actor.id,
    ip: actor.ip,
    reason: input.reason,
    bank: input.bank,
    staffHandsCash: false,
    requireBankForTransfer: false,
    decide: ({ paid, quote }) => {
      const total = paid!.amount.toNumber();
      if (input.mode === "policy") {
        if (input.expectedAmount !== undefined && input.expectedAmount !== quote.amount) refundChanged(input.expectedAmount, quote);
        return { amount: quote.amount, percent: quote.percent, tierHours: quote.tierHours, mode: "policy" };
      }
      if (input.mode === "full") return { amount: total, percent: 100, tierHours: null, mode: "full" };
      const amount = input.amount!;
      return { amount, percent: total > 0 ? Math.floor((amount / total) * 100) : 0, tierHours: null, mode: "custom" };
    },
  });
}

// ຂໍ້ຕົກລົງ 57: cashier ຍົກເລີກການຂາຍ POS ຂອງມື້ນີ້ ທີ່ຍັງບໍ່ສະແກນ — ເງິນສົດເຕັມຢ່າງດຽວ · ເຫດຜົນບັງຄັບ
export function voidGateSale(code: string, input: z.infer<typeof posVoidSchema>, actor: Actor) {
  return cancelCore({
    code,
    by: actor.id,
    ip: actor.ip,
    reason: input.reason,
    staffHandsCash: true,
    requireBankForTransfer: false,
    extraCheck: (b) => {
      if (b.channel !== "gate" || dbDateToIso(b.visit_date) !== todayInVientiane()) throw new BusinessError(409, "not_todays_gate_sale");
      if (b.status !== "paid") throw new BusinessError(409, "not_cancellable", { status: b.status });
    },
    decide: ({ paid }) => {
      if (paid!.method !== "cash") throw new BusinessError(409, "not_cash");
      return { amount: paid!.amount.toNumber(), percent: 100, tierHours: null, mode: "pos_void" };
    },
  });
}

// ຄືນສຳເລັດ (ໂອນແລ້ວ ຫຼື ຍື່ນເງິນສົດແລ້ວ): requested → completed ເທື່ອດຽວ · ລ້າງເລກບັນຊີ ເຫຼືອ 4 ຕົວທ້າຍ (ຂໍ້ຕົກລົງ 55)
// ເລກອ້າງອີງບັງຄັບສະເພາະການໂອນ · refunded_at = ຕອນກົດຢືນຢັນ = ເວລາເງິນອອກແທ້ (ຂໍ້ຕົກລົງ 44)
export async function completeRefund(id: bigint, input: z.infer<typeof completeSchema>, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const [r] = await tx.$queryRaw<{ id: bigint; status: string; method: string; amount: Prisma.Decimal; payment_id: bigint; reason: string; account_last4: string | null }[]>`
      SELECT id, status, method, amount, payment_id, reason, account_last4 FROM refunds WHERE id = ${id} FOR UPDATE`;
    if (!r) throw new BusinessError(404, "not_found");
    if (r.status !== "requested") throw new BusinessError(409, "already_completed");
    if (r.method === "bank_transfer" && !input.transferRef) throw new BusinessError(422, "transfer_ref_required");
    const now = new Date();
    await tx.refunds.update({
      where: { id },
      data: { status: "completed", completed_by: actor.id, completed_at: now, transfer_ref: input.transferRef || null, account_number: null },
    });
    await tx.payments.update({ where: { id: r.payment_id }, data: { status: "refunded", refund_amount: r.amount, refund_reason: r.reason, refunded_at: now } });
    await writeAudit(tx, actor, {
      action: "refund.complete",
      table: "refunds",
      recordId: id,
      newValue: { amount: r.amount.toFixed(0), method: r.method, transferRef: input.transferRef ?? null, accountLast4: r.account_last4 },
    });
    return { ok: true };
  });
}

// ຂໍ້ຕົກລົງ 55: ຄ້າງ requested ເກີນ refund_account_retention_days → ລ້າງເລກບັນຊີ (ເຫຼືອ 4 ຕົວທ້າຍ) — idempotent
export async function purgeStaleRefundAccounts(db: Db = prisma): Promise<number> {
  const days = await getIntSetting("refund_account_retention_days", db);
  const stale = await db.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM refunds WHERE status = 'requested' AND account_number IS NOT NULL AND created_at < UTC_TIMESTAMP() - INTERVAL ${days} DAY`;
  if (stale.length === 0) return 0;
  const ids = stale.map((s) => s.id);
  await db.refunds.updateMany({ where: { id: { in: ids }, account_number: { not: null } }, data: { account_number: null, account_purged_at: new Date() } });
  await db.audit_logs.create({
    data: { action: "refund.account_purge", table_name: "refunds", new_value: { ids: ids.map(String), retentionDays: days } },
  });
  return ids.length;
}

// ຄິວໂອນຄືນ (admin + cashier) — ເລກບັນຊີເຕັມສະເພາະທີ່ຍັງບໍ່ຖືກລ້າງ
export async function listRefundQueue() {
  await purgeStaleRefundAccounts();
  const days = await getIntSetting("refund_account_retention_days");
  const cutoff = Date.now() - days * 86_400_000;
  const rows = await prisma.refunds.findMany({
    where: { status: "requested" },
    orderBy: { created_at: "asc" },
    include: {
      bookings: { select: { booking_code: true, visit_date: true, total_amount: true, cancelled_at: true, customers: { select: { full_name: true, phone: true } } } },
      users_refunds_requested_byTousers: { select: { full_name: true } },
    },
  });
  return rows.map((r) => ({
    id: String(r.id),
    bookingCode: r.bookings.booking_code,
    visitDate: dbDateToIso(r.bookings.visit_date),
    cancelledAt: (r.bookings.cancelled_at ?? r.created_at).toISOString(),
    paid: r.bookings.total_amount.toNumber(),
    amount: r.amount.toNumber(),
    percent: r.refund_percent,
    method: r.method,
    reason: r.reason,
    requestedBy: r.users_refunds_requested_byTousers?.full_name ?? null,
    customerName: r.bookings.customers?.full_name ?? null,
    customerPhone: r.bookings.customers?.phone ?? null,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    accountName: r.account_name,
    accountLast4: r.account_last4,
    purged: r.account_purged_at !== null,
    stale: r.created_at.getTime() < cutoff,
  }));
}

// ການຂາຍ POS ຂອງມື້ນີ້ ທີ່ຍັງບໍ່ສະແກນ (ຍົກເລີກໄດ້ — ຂໍ້ຕົກລົງ 57)
export async function listVoidableGateSales() {
  const rows = await prisma.bookings.findMany({
    where: { channel: "gate", status: "paid", visit_date: isoDateToDb(todayInVientiane()) },
    orderBy: { id: "desc" },
    take: 100,
    select: { booking_code: true, total_amount: true, created_at: true, users: { select: { full_name: true } }, booking_items: { select: { quantity: true } } },
  });
  return rows.map((b) => ({
    bookingCode: b.booking_code,
    total: b.total_amount.toNumber(),
    soldAt: b.created_at.toISOString(),
    seller: b.users?.full_name ?? null,
    people: b.booking_items.reduce((n, i) => n + i.quantity, 0),
  }));
}

// ໜ້າລູກຄ້າ / admin ຫຼັງຍົກເລີກ: ສະຖານະການຄືນເງິນ (ບໍ່ມີເລກບັນຊີເຕັມ — ຂໍ້ຕົກລົງ 55)
export async function refundInfo(code: string) {
  const b = await prisma.bookings.findUnique({
    where: { booking_code: code },
    select: {
      cancelled_at: true,
      cancel_reason: true,
      users_bookings_cancelled_byTousers: { select: { full_name: true } },
      refunds: { select: { amount: true, refund_percent: true, status: true, method: true, account_last4: true, completed_at: true, transfer_ref: true }, take: 1 },
    },
  });
  if (!b?.cancelled_at) return null;
  const r = b.refunds[0];
  return {
    cancelledAt: b.cancelled_at.toISOString(),
    cancelReason: b.cancel_reason,
    cancelledBy: b.users_bookings_cancelled_byTousers?.full_name ?? null,
    refund: r
      ? {
          amount: r.amount.toNumber(),
          percent: r.refund_percent,
          status: r.status,
          method: r.method,
          last4: r.account_last4,
          completedAt: r.completed_at?.toISOString() ?? null,
          transferRef: r.transfer_ref,
        }
      : null,
  };
}

// dashboard (ຂໍ້ຕົກລົງ 44, 55, 57): ລໍໂອນຄືນ · ຄ້າງເກີນກຳນົດ · ຍົກເລີກຢູ່ POS ມື້ນີ້
export async function refundDashboard() {
  await purgeStaleRefundAccounts();
  const days = await getIntSetting("refund_account_retention_days");
  const today = todayInVientiane();
  const [pending] = await prisma.$queryRaw<{ n: bigint; amount: Prisma.Decimal | null; stale: Prisma.Decimal | null }[]>`
    SELECT COUNT(*) AS n, SUM(amount) AS amount, SUM(created_at < UTC_TIMESTAMP() - INTERVAL ${days} DAY) AS stale
    FROM refunds WHERE status = 'requested'`;
  const [voids] = await prisma.$queryRaw<{ n: bigint; amount: Prisma.Decimal | null }[]>`
    SELECT COUNT(*) AS n, SUM(r.amount) AS amount FROM refunds r JOIN bookings b ON b.id = r.booking_id
    WHERE b.channel = 'gate' AND r.method = 'cash' AND r.status = 'completed'
      AND DATE(CONVERT_TZ(r.completed_at, '+00:00', '+07:00')) = ${today}`;
  return {
    retentionDays: days,
    pending: { count: Number(pending.n), amount: Number(pending.amount ?? 0), stale: Number(pending.stale ?? 0) },
    posVoidsToday: { count: Number(voids.n), amount: Number(voids.amount ?? 0) },
  };
}
