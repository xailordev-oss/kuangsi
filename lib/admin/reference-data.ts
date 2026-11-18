import { z } from "zod";
import { writeAudit, type Actor } from "@/lib/admin/audit";
import type { Impact } from "@/lib/admin/settings";
import { BusinessError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { DISPLAY_CURRENCIES } from "@/lib/exchange";
import { Prisma } from "@/lib/generated/prisma/client";
import { dbDateToIso, isoDateToDb, isValidIsoDate, todayInVientiane } from "@/lib/time";

// ===== ອັດຕາແລກປ່ຽນ — ເພີ່ມຢ່າງດຽວ ບໍ່ແກ້ແຖວເກົ່າ (ຄຳຖາມ B3) · ໃຊ້ສະແດງຄ່າປະມານເທົ່ານັ້ນ (ຂໍ້ຕົກລົງ 30) =====

export const rateSchema = z.object({
  currency: z.enum(DISPLAY_CURRENCIES),
  // ກີບຕໍ່ 1 ໜ່ວຍ · DECIMAL(14,6)
  lakPerUnit: z.string().trim().regex(/^\d{1,8}(\.\d{1,6})?$/).refine((v) => Number(v) > 0, { message: "positive" }),
  effectiveDate: z.string().refine(isValidIsoDate).refine((d) => d >= todayInVientiane(), { message: "past_date" }),
  confirm: z.boolean().optional(),
});

export async function listRates() {
  const rows = await prisma.exchange_rates.findMany({ orderBy: [{ effective_date: "desc" }, { id: "desc" }], take: 50 });
  return rows.map((r) => ({
    id: String(r.id),
    from: r.from_currency,
    to: r.to_currency,
    rate: r.rate.toString(),
    effectiveDate: dbDateToIso(r.effective_date),
  }));
}

export async function addRate(input: z.infer<typeof rateSchema>, actor: Actor) {
  try {
    return await prisma.$transaction(async (tx) => {
      // ເພີ່ມແລ້ວແກ້ບໍ່ໄດ້ → ຢືນຢັນທຸກຄັ້ງ ພ້ອມອັດຕາກ່ອນໜ້າໃຫ້ປຽບທຽບ (ກັນພິມເລກສູນເກີນ/ຂາດ)
      if (!input.confirm) {
        const prev = await tx.exchange_rates.findFirst({
          where: { from_currency: input.currency, to_currency: "LAK" },
          orderBy: { effective_date: "desc" },
        });
        const impact: Impact = {
          kind: "rate",
          currency: input.currency,
          previous: prev ? { rate: prev.rate.toString(), date: dbDateToIso(prev.effective_date) } : null,
          next: { rate: input.lakPerUnit, date: input.effectiveDate },
        };
        throw new BusinessError(409, "confirm_required", { impact });
      }
      const r = await tx.exchange_rates.create({
        data: { from_currency: input.currency, to_currency: "LAK", rate: input.lakPerUnit, effective_date: isoDateToDb(input.effectiveDate) },
        select: { id: true },
      });
      await writeAudit(tx, actor, {
        action: "exchange_rate.create",
        table: "exchange_rates",
        recordId: r.id,
        newValue: { currency: input.currency, lakPerUnit: input.lakPerUnit, effectiveDate: input.effectiveDate },
      });
      return { id: String(r.id) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new BusinessError(409, "rate_exists");
    throw error;
  }
}

// ===== ສະຖານທີ່ (places) — ປິດດ້ວຍ is_active ບໍ່ລຶບ (ຄຳຖາມ B4) =====

// ກັນພິມ lat/lng ສະຫຼັບກັນ ຫຼື ຜິດປະເທດ — ສະຖານທີ່ເປັນຈຸດເລີ່ມເດີນທາງມາຕາດ ຈຶ່ງຕ້ອງຢູ່ໃນ ສປປ ລາວ
const LAOS = { lat: [13.9, 22.6], lng: [100.0, 107.7] } as const;
const coord = (min: number, max: number) => z.number().min(min).max(max).transform((v) => Math.round(v * 1e6) / 1e6);
const name = (max: number) => z.string().trim().min(1).max(max);
const optName = z.string().trim().max(150).optional().transform((v) => v || null);

const placeFields = {
  nameLo: name(150),
  nameEn: name(150),
  nameZh: optName,
  nameTh: optName,
  type: z.enum(["hotel", "landmark", "airport"]),
  lat: coord(LAOS.lat[0], LAOS.lat[1]),
  lng: coord(LAOS.lng[0], LAOS.lng[1]),
};
export const placeSchema = z.object(placeFields);
export const placeUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), ...placeFields }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("activate") }),
]);

export async function listPlaces() {
  const rows = await prisma.places.findMany({ orderBy: [{ is_active: "desc" }, { type: "asc" }, { id: "asc" }] });
  return rows.map((p) => ({
    id: String(p.id),
    nameLo: p.name_lo,
    nameEn: p.name_en,
    nameZh: p.name_zh,
    nameTh: p.name_th,
    type: p.type,
    lat: p.lat.toNumber(),
    lng: p.lng.toNumber(),
    distanceKm: p.distance_km?.toNumber() ?? null,
    isActive: p.is_active,
  }));
}

type PlaceInput = z.infer<typeof placeSchema>;
const toRow = (p: PlaceInput) => ({ name_lo: p.nameLo, name_en: p.nameEn, name_zh: p.nameZh, name_th: p.nameTh, type: p.type, lat: p.lat, lng: p.lng });

export async function addPlace(input: PlaceInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.places.create({ data: toRow(input), select: { id: true } });
    await writeAudit(tx, actor, { action: "place.create", table: "places", recordId: p.id, newValue: { ...input } });
    return { id: String(p.id) };
  });
}

export async function updatePlace(id: bigint, change: z.infer<typeof placeUpdateSchema>, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const p = await tx.places.findUnique({ where: { id } });
    if (!p) throw new BusinessError(404, "not_found");
    if (change.action !== "edit") {
      const active = change.action === "activate";
      if (p.is_active === active) return;
      await tx.places.update({ where: { id }, data: { is_active: active } });
      await writeAudit(tx, actor, { action: `place.${change.action}`, table: "places", recordId: id, oldValue: { isActive: p.is_active }, newValue: { isActive: active } });
      return;
    }
    const input: PlaceInput = { nameLo: change.nameLo, nameEn: change.nameEn, nameZh: change.nameZh, nameTh: change.nameTh, type: change.type, lat: change.lat, lng: change.lng };
    const before = { nameLo: p.name_lo, nameEn: p.name_en, nameZh: p.name_zh, nameTh: p.name_th, type: p.type, lat: p.lat.toNumber(), lng: p.lng.toNumber() };
    const changedKeys = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== input[k]);
    if (changedKeys.length === 0) return;
    // ພິກັດປ່ຽນ → ໄລຍະທາງເກົ່າໃຊ້ບໍ່ໄດ້ · ລໍ npm run places:routes (ຫ້າມໃສ່ໄລຍະເອງ — ຂໍ້ຕົກລົງ 8)
    const moved = changedKeys.includes("lat") || changedKeys.includes("lng");
    await tx.places.update({ where: { id }, data: { ...toRow(input), ...(moved && { distance_km: null, duration_min: null }) } });
    await writeAudit(tx, actor, {
      action: "place.update",
      table: "places",
      recordId: id,
      oldValue: Object.fromEntries(changedKeys.map((k) => [k, before[k]])),
      newValue: { ...Object.fromEntries(changedKeys.map((k) => [k, input[k]])), ...(moved && { _distanceReset: true }) },
    });
  });
}
