import { z } from "zod";
import { writeAudit, type Actor } from "@/lib/admin/audit";
import { confirmRequired, impactSummary, type CatalogImpact } from "@/lib/admin/settings";
import { BusinessError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/settings";

// 10c — ປະເພດປີ້ ແລະ ບໍລິການເສີມ (ກະທົບລາຄາ — ຂໍ້ຕົກລົງ 37)
// ຂໍ້ຕົກລົງ 51: ລາຄາມີຜົນທັນທີ · ການຈອງທີ່ມີແລ້ວຖື snapshot (booking_items.unit_price) ບໍ່ປ່ຽນຕາມ
// ຂໍ້ຕົກລົງ 52: code · ກຸ່ມ · ກຸ່ມອາຍຸ · ໜ່ວຍ ລັອກຫຼັງສ້າງ (strictObject → ສົ່ງມາ = 400) · ລຶບບໍ່ໄດ້ (ປິດຂາຍແທນ)

const name = (max: number) => z.string().trim().min(1).max(max);
const optName = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
// ກີບບໍ່ມີທົດສະນິຍົມ (ຂໍ້ຕົກລົງ 1, 32)
const price = z.number().int().min(0).max(10_000_000);
const age = z.number().int().min(0).max(120).nullable();
const code = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,29}$/);

const names = { nameLo: name(100), nameEn: name(100), nameZh: optName(100), nameTh: optName(100) };
const ticketEditable = { ...names, price, ageMin: age, ageMax: age, sortOrder: z.number().int().min(0).max(999), isActive: z.boolean() };
const ageOrder = (v: { ageMin: number | null; ageMax: number | null }) => v.ageMin === null || v.ageMax === null || v.ageMin <= v.ageMax;

export const ticketCreateSchema = z
  .strictObject({
    code,
    visitorGroup: z.enum(["lao", "foreigner"]),
    ageGroup: z.enum(["adult", "child", "senior", "free"]),
    ...ticketEditable,
    confirm: z.boolean().optional(),
  })
  .refine(ageOrder, { message: "age_range", path: ["ageMax"] })
  // ປີ້ຟຣີ ⇔ ລາຄາ 0 (ຍອດ 0 ກີບ = nothing_to_pay — ຂໍ້ຕົກລົງ 26)
  .refine((v) => (v.ageGroup === "free") === (v.price === 0), { message: "free_price_mismatch", path: ["price"] });

export const ticketUpdateSchema = z.strictObject({ ...ticketEditable, confirm: z.boolean().optional() }).refine(ageOrder, { message: "age_range", path: ["ageMax"] });

const addOnEditable = { ...names, price, isActive: z.boolean() };
export const addOnCreateSchema = z.strictObject({ code, unit: z.enum(["per_person", "per_booking", "per_item"]), ...addOnEditable, confirm: z.boolean().optional() });
export const addOnUpdateSchema = z.strictObject({ ...addOnEditable, confirm: z.boolean().optional() });

export async function listTicketTypes() {
  const rows = await prisma.ticket_types.findMany({ orderBy: [{ visitor_group: "asc" }, { sort_order: "asc" }, { id: "asc" }] });
  return rows.map((t) => ({
    id: String(t.id),
    code: t.code,
    visitorGroup: t.visitor_group,
    ageGroup: t.age_group,
    nameLo: t.name_lo,
    nameEn: t.name_en,
    nameZh: t.name_zh,
    nameTh: t.name_th,
    ageMin: t.age_min,
    ageMax: t.age_max,
    price: t.price.toNumber(),
    sortOrder: t.sort_order,
    isActive: t.is_active,
  }));
}

export async function listAddOns() {
  const rows = await prisma.add_ons.findMany({ orderBy: [{ is_active: "desc" }, { id: "asc" }] });
  return rows.map((a) => ({
    id: String(a.id),
    code: a.code,
    unit: a.unit,
    nameLo: a.name_lo,
    nameEn: a.name_en,
    nameZh: a.name_zh,
    nameTh: a.name_th,
    price: a.price.toNumber(),
    isActive: a.is_active,
  }));
}

// ການຈອງທີ່ຍັງບໍ່ຈ່າຍ ແລະ ຖືລາຄາເກົ່າ (snapshot) — ບອກ admin ວ່າຄົນເຫຼົ່ານີ້ຍັງຈ່າຍລາຄາເກົ່າ
async function holdingBookings(tx: Db, kind: "ticket" | "addOn", id: bigint) {
  const join =
    kind === "ticket"
      ? Prisma.sql`JOIN booking_items x ON x.booking_id = b.id AND x.ticket_type_id = ${id}`
      : Prisma.sql`JOIN booking_add_ons x ON x.booking_id = b.id AND x.add_on_id = ${id}`;
  const rows = await tx.$queryRaw<{ status: string; n: bigint }[]>`
    SELECT b.status, COUNT(DISTINCT b.id) AS n FROM bookings b ${join}
    WHERE b.status = 'verifying' OR (b.status = 'pending' AND b.expires_at > UTC_TIMESTAMP())
    GROUP BY b.status`;
  const count = (s: string) => Number(rows.find((r) => r.status === s)?.n ?? 0);
  return { pending: count("pending"), verifying: count("verifying") };
}

const kip = (v: Prisma.Decimal | number) => new Prisma.Decimal(v).toFixed(0);
type Changes = Record<string, { old: unknown; new: unknown }>;

function diff(before: Record<string, unknown>, after: Record<string, unknown>): Changes {
  return Object.fromEntries(Object.keys(after).filter((k) => before[k] !== after[k]).map((k) => [k, { old: before[k], new: after[k] }]));
}

async function auditChanges(tx: Db, actor: Actor, table: string, prefix: string, id: bigint, changes: Changes, impact?: CatalogImpact) {
  await writeAudit(tx, actor, {
    // ລາຄາປ່ຽນ → action ແຍກ ໃຫ້ຄົ້ນຫາປະຫວັດລາຄາໄດ້ງ່າຍ
    action: "price" in changes ? `${prefix}.price` : `${prefix}.update`,
    table,
    recordId: id,
    oldValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old as Prisma.InputJsonValue])),
    newValue: {
      ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new as Prisma.InputJsonValue])),
      ...(impact && { _impact: impactSummary(impact) }),
    },
  });
}

function codeTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ===== ປະເພດປີ້ =====

export async function createTicketType(input: z.infer<typeof ticketCreateSchema>, actor: Actor) {
  const { confirm, ...v } = input;
  try {
    return await prisma.$transaction(async (tx) => {
      if (!confirm) {
        confirmRequired({
          impact: { kind: "catalog", name: v.nameLo, oldPrice: null, newPrice: kip(v.price), deactivating: false, holding: { pending: 0, verifying: 0 }, lastPaidInGroup: null },
        });
      }
      const t = await tx.ticket_types.create({
        data: {
          code: v.code,
          visitor_group: v.visitorGroup,
          age_group: v.ageGroup,
          name_lo: v.nameLo,
          name_en: v.nameEn,
          name_zh: v.nameZh,
          name_th: v.nameTh,
          age_min: v.ageMin,
          age_max: v.ageMax,
          price: v.price,
          currency: "LAK",
          sort_order: v.sortOrder,
          is_active: v.isActive,
        },
        select: { id: true },
      });
      await writeAudit(tx, actor, { action: "ticket_type.create", table: "ticket_types", recordId: t.id, newValue: { ...v } });
      return { id: String(t.id) };
    });
  } catch (error) {
    if (codeTaken(error)) throw new BusinessError(409, "code_taken");
    throw error;
  }
}

export async function updateTicketType(id: bigint, input: z.infer<typeof ticketUpdateSchema>, actor: Actor) {
  const { confirm, ...v } = input;
  return prisma.$transaction(async (tx) => {
    const [t] = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM ticket_types WHERE id = ${id} FOR UPDATE`;
    if (!t) throw new BusinessError(404, "not_found");
    const row = (await tx.ticket_types.findUnique({ where: { id } }))!;
    if ((row.age_group === "free") !== (v.price === 0)) throw new BusinessError(422, "free_price_mismatch");

    const before = {
      nameLo: row.name_lo,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      nameTh: row.name_th,
      price: row.price.toNumber(),
      ageMin: row.age_min,
      ageMax: row.age_max,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    };
    const changes = diff(before, v);
    if (Object.keys(changes).length === 0) return { changed: 0 };

    const deactivating = row.is_active && !v.isActive;
    let impact: CatalogImpact | undefined;
    if ("price" in changes || deactivating) {
      const others = deactivating
        ? await tx.ticket_types.count({ where: { id: { not: id }, visitor_group: row.visitor_group, is_active: true, price: { gt: 0 } } })
        : 1;
      impact = {
        kind: "catalog",
        name: row.name_lo,
        oldPrice: kip(row.price),
        newPrice: kip(v.price),
        deactivating,
        holding: await holdingBookings(tx, "ticket", id),
        lastPaidInGroup: deactivating && row.price.gt(0) && others === 0 ? row.visitor_group : null,
      };
      if (!confirm) confirmRequired({ impact });
    }

    await tx.ticket_types.update({
      where: { id },
      data: {
        name_lo: v.nameLo,
        name_en: v.nameEn,
        name_zh: v.nameZh,
        name_th: v.nameTh,
        price: v.price,
        age_min: v.ageMin,
        age_max: v.ageMax,
        sort_order: v.sortOrder,
        is_active: v.isActive,
      },
    });
    await auditChanges(tx, actor, "ticket_types", "ticket_type", id, changes, impact);
    return { changed: Object.keys(changes).length };
  });
}

// ===== ບໍລິການເສີມ (POS ບໍ່ຂາຍ — ຂໍ້ຕົກລົງ 41) =====

export async function createAddOn(input: z.infer<typeof addOnCreateSchema>, actor: Actor) {
  const { confirm, ...v } = input;
  try {
    return await prisma.$transaction(async (tx) => {
      if (!confirm) {
        confirmRequired({
          impact: { kind: "catalog", name: v.nameLo, oldPrice: null, newPrice: kip(v.price), deactivating: false, holding: { pending: 0, verifying: 0 }, lastPaidInGroup: null },
        });
      }
      const a = await tx.add_ons.create({
        data: { code: v.code, unit: v.unit, name_lo: v.nameLo, name_en: v.nameEn, name_zh: v.nameZh, name_th: v.nameTh, price: v.price, currency: "LAK", is_active: v.isActive },
        select: { id: true },
      });
      await writeAudit(tx, actor, { action: "add_on.create", table: "add_ons", recordId: a.id, newValue: { ...v } });
      return { id: String(a.id) };
    });
  } catch (error) {
    if (codeTaken(error)) throw new BusinessError(409, "code_taken");
    throw error;
  }
}

export async function updateAddOn(id: bigint, input: z.infer<typeof addOnUpdateSchema>, actor: Actor) {
  const { confirm, ...v } = input;
  return prisma.$transaction(async (tx) => {
    const [a] = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM add_ons WHERE id = ${id} FOR UPDATE`;
    if (!a) throw new BusinessError(404, "not_found");
    const row = (await tx.add_ons.findUnique({ where: { id } }))!;
    const before = { nameLo: row.name_lo, nameEn: row.name_en, nameZh: row.name_zh, nameTh: row.name_th, price: row.price.toNumber(), isActive: row.is_active };
    const changes = diff(before, v);
    if (Object.keys(changes).length === 0) return { changed: 0 };

    const deactivating = row.is_active && !v.isActive;
    let impact: CatalogImpact | undefined;
    if ("price" in changes || deactivating) {
      impact = {
        kind: "catalog",
        name: row.name_lo,
        oldPrice: kip(row.price),
        newPrice: kip(v.price),
        deactivating,
        holding: await holdingBookings(tx, "addOn", id),
        lastPaidInGroup: null,
      };
      if (!confirm) confirmRequired({ impact });
    }
    await tx.add_ons.update({
      where: { id },
      data: { name_lo: v.nameLo, name_en: v.nameEn, name_zh: v.nameZh, name_th: v.nameTh, price: v.price, is_active: v.isActive },
    });
    await auditChanges(tx, actor, "add_ons", "add_on", id, changes, impact);
    return { changed: Object.keys(changes).length };
  });
}
