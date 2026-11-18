import { z } from "zod";
import { isIsoCountry } from "@/lib/countries";
import { normalizePhone } from "@/lib/phone";
import { isValidIsoDate } from "@/lib/time";

const isoDate = z.string().refine(isValidIsoDate, { message: "expected YYYY-MM-DD" });

const dbId = z
  .union([z.string().regex(/^\d{1,19}$/), z.number().int().positive()])
  .transform((v) => BigInt(v));

// ຮັບໄດ້ທັງ "020 5555 5555" ແລະ "+856…" ແລ້ວເກັບເປັນ E.164 ເພື່ອໃຫ້ກວດເບີຊ້ຳໄດ້ຖືກ (ຂໍ້ຕົກລົງ 4, 24)
export const phoneSchema = z
  .string()
  .max(40)
  .transform((value, ctx) => {
    const e164 = normalizePhone(value);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "invalid phone number" });
      return z.NEVER;
    }
    return e164;
  });

export const bookingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^KS-[23456789A-HJ-NP-Z]{5}$/);

const quantity = z.number().int().min(1).max(999);

const ticketLines = z
  .array(z.object({ ticketTypeId: dbId, quantity }))
  .min(1)
  .max(20)
  .refine((lines) => new Set(lines.map((l) => l.ticketTypeId)).size === lines.length, {
    message: "duplicate ticketTypeId",
  });

const addOnLines = z
  .array(z.object({ addOnId: dbId, quantity }))
  .max(20)
  .refine((lines) => new Set(lines.map((l) => l.addOnId)).size === lines.length, { message: "duplicate addOnId" })
  .default([]);

// ຂໍ້ຕົກລົງ 50: ຍອດທີ່ຜູ້ໃຊ້ເຫັນ ແລະ ກົດຢືນຢັນ — ບໍ່ກົງກັບລາຄາປັດຈຸບັນ → 409 price_changed (ບໍ່ສ້າງການຈອງ)
const expectedTotal = z.number().int().min(0).max(1_000_000_000);

const onlineCustomer = z
  .object({
    fullName: z.string().trim().min(1).max(150),
    phone: phoneSchema,
    email: z.email().max(255).optional(),
    nationality: z.string().refine(isIsoCountry, { message: "expected ISO 3166-1 alpha-2 country code" }).optional(),
    idType: z.enum(["national_id", "passport", "other"]).optional(),
    idNumber: z.string().trim().min(1).max(50).optional(),
  })
  .refine((c) => !c.idNumber || c.idType, { message: "idType is required with idNumber", path: ["idType"] });

export const createOnlineBookingSchema = z.object({
  visitDate: isoDate,
  items: ticketLines,
  addOns: addOnLines,
  customer: onlineCustomer,
  expectedTotal,
});

// ຂໍ້ມູນລູກຄ້າບໍ່ບັງຄັບຢູ່ POS (ຂໍ້ຕົກລົງ 16)
export const posSaleSchema = z.object({
  items: ticketLines,
  addOns: addOnLines,
  customer: z
    .object({
      fullName: z.string().trim().min(1).max(150).optional(),
      phone: phoneSchema.optional(),
    })
    .optional(),
  cashReceived: z.number().int().min(0).max(1_000_000_000),
  expectedTotal,
  // ຂໍ້ຕົກລົງ 41: ກົດຊ້ຳ / ເນັດຂາດກາງທາງ → ສົ່ງ requestId ເດີມ ໄດ້ຜົນເດີມ ບໍ່ຂາຍຊ້ຳ
  requestId: z.uuid().optional(),
});

export const lookupSchema = z.object({ bookingCode: bookingCodeSchema, phone: phoneSchema });

export const MAX_AVAILABILITY_DAYS = 62;

export const availabilityQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to", path: ["to"] })
  .refine(
    (q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 < MAX_AVAILABILITY_DAYS,
    { message: `range must be under ${MAX_AVAILABILITY_DAYS} days`, path: ["to"] },
  );

export type TicketLineInput = z.output<typeof ticketLines>[number];
export type AddOnLineInput = z.output<typeof addOnLines>[number];
