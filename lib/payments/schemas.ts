import { z } from "zod";

export const paymentIdSchema = z.string().regex(/^\d{1,19}$/).transform((v) => BigInt(v));

export const approveSchema = z.object({
  transactionId: z.string().trim().max(100).optional().transform((v) => v || undefined),
});

// reject_reason ລູກຄ້າເຫັນ (ຂໍ້ຕົກລົງ 20) — ບັງຄັບ, ບໍ່ເກີນ VARCHAR(255)
export const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(255),
});
