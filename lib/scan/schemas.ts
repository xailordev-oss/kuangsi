import { z } from "zod";
import { bookingCodeSchema } from "@/lib/booking/schemas";

const qrToken = z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform((v) => v.toLowerCase());
const gate = z.string().trim().min(1).max(30);

// ສະແກນ QR (qrToken) ຫຼື ພິມລະຫັດຈອງເອງ (bookingCode) — ຢ່າງໃດຢ່າງໜຶ່ງ
const ticketRef = z
  .object({ qrToken: qrToken.optional(), bookingCode: bookingCodeSchema.optional() })
  .refine((v) => !!v.qrToken !== !!v.bookingCode, { message: "provide exactly one of qrToken or bookingCode" });

export const scanSchema = z.object({ gate }).and(ticketRef);

export const syncSchema = z.object({
  items: z
    .array(
      z.object({ offlineId: z.uuid(), gate, scannedAt: z.iso.datetime() }).and(ticketRef),
    )
    .min(1)
    .max(200),
});
