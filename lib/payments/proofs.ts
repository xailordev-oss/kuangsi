import { BusinessError } from "@/lib/api";
import { expireStaleBookings } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";
import { deleteProof, detectImageType, PROOF_MAX_BYTES, saveProof } from "@/lib/payments/proof-storage";
import { getIntSetting } from "@/lib/settings";
import { dbDateToIso } from "@/lib/time";

// ຂໍ້ຕົກລົງ 38: ການໂອນບັນທຶກເປັນ bank_transfer ສະເໝີ (ບໍ່ແມ່ນ other) ເພື່ອໃຫ້ລາຍງານແຍກໄດ້
const TRANSFER_METHOD = "bank_transfer" as const;

// ລູກຄ້າສົ່ງຫຼັກຖານ: pending → verifying + expires_at = NULL (ຂໍ້ຕົກລົງ 15)
export async function submitProof(bookingCode: string, file: File) {
  if (file.size === 0 || file.size > PROOF_MAX_BYTES) {
    throw new BusinessError(422, "invalid_file", { maxBytes: PROOF_MAX_BYTES });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) throw new BusinessError(422, "invalid_file", { maxBytes: PROOF_MAX_BYTES });

  await expireStaleBookings(prisma, { booking_code: bookingCode });
  const booking = await prisma.bookings.findUnique({
    where: { booking_code: bookingCode },
    select: { id: true, status: true, total_amount: true },
  });
  if (!booking) throw new BusinessError(404, "not_found");
  if (booking.status !== "pending") throw new BusinessError(409, "not_pending", { status: booking.status });

  const name = await saveProof(bytes, ext);
  try {
    await prisma.$transaction(async (tx) => {
      // ເງື່ອນໄຂໃນ WHERE ກັນກໍລະນີໝົດເວລາ ຫຼື ສົ່ງຊ້ຳພ້ອມກັນ
      const moved = await tx.bookings.updateMany({
        where: { id: booking.id, status: "pending", expires_at: { gt: new Date() } },
        data: { status: "verifying", expires_at: null },
      });
      if (moved.count !== 1) throw new BusinessError(409, "not_pending", { status: "expired" });
      await tx.payments.create({
        data: {
          booking_id: booking.id,
          method: TRANSFER_METHOD,
          amount: booking.total_amount,
          currency: "LAK",
          proof_url: name,
          status: "pending",
        },
      });
    });
  } catch (error) {
    await deleteProof(name);
    throw error;
  }
}

// ຮູບຫຼ້າສຸດຂອງການຈອງ (ໃຫ້ລູກຄ້າເບິ່ງຂອງຕົນເອງ)
export async function latestProofName(bookingCode: string): Promise<string | null> {
  const payment = await prisma.payments.findFirst({
    where: { bookings: { booking_code: bookingCode }, proof_url: { not: null } },
    orderBy: { id: "desc" },
    select: { proof_url: true },
  });
  return payment?.proof_url ?? null;
}

export async function proofNameForPayment(paymentId: bigint): Promise<string | null> {
  const payment = await prisma.payments.findUnique({ where: { id: paymentId }, select: { proof_url: true } });
  return payment?.proof_url ?? null;
}

export type ProofQueueItem = {
  paymentId: string;
  bookingCode: string;
  visitDate: string;
  total: string;
  customerName: string | null;
  customerPhone: string | null;
  submittedAt: string;
  waitedMinutes: number;
};

// ລໍກວດ: ການຈອງ verifying ທີ່ມີ payment pending · ເກົ່າສຸດກ່ອນ
export async function listProofQueue(): Promise<ProofQueueItem[]> {
  const payments = await prisma.payments.findMany({
    where: { status: "pending", proof_url: { not: null }, bookings: { status: "verifying" } },
    orderBy: { created_at: "asc" },
    include: { bookings: { include: { customers: { select: { full_name: true, phone: true } } } } },
  });
  return payments.map((p) => ({
    paymentId: p.id.toString(),
    bookingCode: p.bookings.booking_code,
    visitDate: dbDateToIso(p.bookings.visit_date),
    total: p.bookings.total_amount.toFixed(2),
    customerName: p.bookings.customers?.full_name ?? null,
    customerPhone: p.bookings.customers?.phone ?? null,
    submittedAt: p.created_at.toISOString(),
    waitedMinutes: Math.max(0, Math.round((Date.now() - p.created_at.getTime()) / 60_000)),
  }));
}

async function loadForReview(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], paymentId: bigint) {
  const payment = await tx.payments.findUnique({
    where: { id: paymentId },
    include: { bookings: { select: { id: true, booking_code: true, status: true } }, users: { select: { full_name: true } } },
  });
  if (!payment?.proof_url) throw new BusinessError(404, "not_found");
  if (payment.status !== "pending") {
    throw new BusinessError(409, "already_verified", { verifiedBy: payment.users?.full_name ?? null, status: payment.status });
  }
  if (payment.bookings.status !== "verifying") throw new BusinessError(409, "not_verifying");
  return payment;
}

// ກົດພ້ອມກັນ: ຄົນທີ່ແພ້ຮູ້ຈາກ updateMany ທີ່ໄດ້ 0 ແຖວ — snapshot ໃນ transaction ຍັງເປັນຂໍ້ມູນເກົ່າ
// ຈຶ່ງອ່ານຊື່ຜູ້ກວດຄືນຫຼັງ transaction ຈົບ ເພື່ອບອກ "ກວດແລ້ວໂດຍ …"
async function withVerifierName<T>(paymentId: bigint, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BusinessError && error.code === "already_verified" && !error.details?.verifiedBy) {
      const p = await prisma.payments.findUnique({ where: { id: paymentId }, select: { status: true, users: { select: { full_name: true } } } });
      throw new BusinessError(409, "already_verified", { verifiedBy: p?.users?.full_name ?? null, status: p?.status ?? null });
    }
    throw error;
  }
}

// ອະນຸມັດ: payment success + ຜູ້ກວດ (ຂໍ້ຕົກລົງ 20) · booking paid
export async function approveProof(paymentId: bigint, staffId: bigint, transactionId?: string) {
  return withVerifierName(paymentId, () => prisma.$transaction(async (tx) => {
    const payment = await loadForReview(tx, paymentId);
    const now = new Date();
    const updated = await tx.payments.updateMany({
      where: { id: paymentId, status: "pending" },
      data: { status: "success", paid_at: now, verified_by: staffId, verified_at: now, transaction_id: transactionId ?? null },
    });
    if (updated.count !== 1) throw new BusinessError(409, "already_verified", { verifiedBy: null });
    await tx.bookings.update({ where: { id: payment.bookings.id }, data: { status: "paid", expires_at: null } });
    await tx.audit_logs.create({
      data: {
        user_id: staffId,
        action: "payment.approve",
        table_name: "payments",
        record_id: paymentId,
        old_value: { status: "pending", bookingStatus: "verifying" },
        new_value: { status: "success", bookingStatus: "paid", transactionId: transactionId ?? null },
      },
    });
    return { bookingCode: payment.bookings.booking_code };
  }));
}

// ປະຕິເສດ: payment failed + ເຫດຜົນ (ລູກຄ້າເຫັນ) · booking ກັບເປັນ pending ພ້ອມໂມງໃໝ່ (ຂໍ້ຕົກລົງ 15)
export async function rejectProof(paymentId: bigint, staffId: bigint, reason: string) {
  return withVerifierName(paymentId, () => prisma.$transaction(async (tx) => {
    const payment = await loadForReview(tx, paymentId);
    const holdMinutes = await getIntSetting("booking_hold_minutes", tx);
    const now = new Date();
    const updated = await tx.payments.updateMany({
      where: { id: paymentId, status: "pending" },
      data: { status: "failed", reject_reason: reason, verified_by: staffId, verified_at: now },
    });
    if (updated.count !== 1) throw new BusinessError(409, "already_verified", { verifiedBy: null });
    await tx.bookings.update({
      where: { id: payment.bookings.id },
      data: { status: "pending", expires_at: new Date(now.getTime() + holdMinutes * 60_000) },
    });
    await tx.audit_logs.create({
      data: {
        user_id: staffId,
        action: "payment.reject",
        table_name: "payments",
        record_id: paymentId,
        old_value: { status: "pending", bookingStatus: "verifying" },
        new_value: { status: "failed", bookingStatus: "pending", reason },
      },
    });
    return { bookingCode: payment.bookings.booking_code };
  }));
}
