import { BusinessError } from "@/lib/api";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/settings";
import type { AddOnLineInput, TicketLineInput } from "@/lib/booking/schemas";

export type PricedTicketLine = { ticketTypeId: bigint; quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal };
export type PricedAddOnLine = { addOnId: bigint; quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal };

export type Quote = {
  items: PricedTicketLine[];
  addOns: PricedAddOnLine[];
  people: number;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
};

// ລາຄາມາຈາກ DB ສະເໝີ ບໍ່ເຊື່ອລາຄາຈາກ client · ລາຄາເປັນກີບຢ່າງດຽວ (ຂໍ້ຕົກລົງ 1)
export async function quote(db: Db, items: TicketLineInput[], addOns: AddOnLineInput[]): Promise<Quote> {
  const [ticketTypes, addOnRows] = await Promise.all([
    db.ticket_types.findMany({ where: { id: { in: items.map((i) => i.ticketTypeId) } } }),
    addOns.length ? db.add_ons.findMany({ where: { id: { in: addOns.map((a) => a.addOnId) } } }) : [],
  ]);
  const typeById = new Map(ticketTypes.map((t) => [t.id, t]));
  const addOnById = new Map(addOnRows.map((a) => [a.id, a]));

  const pricedItems = items.map((line) => {
    const type = typeById.get(line.ticketTypeId);
    if (!type || !type.is_active) {
      throw new BusinessError(422, "ticket_type_unavailable", { ticketTypeId: line.ticketTypeId.toString() });
    }
    if (type.currency !== "LAK") throw new BusinessError(500, "non_lak_price", { ticketTypeId: type.id.toString() });
    return { ticketTypeId: type.id, quantity: line.quantity, unitPrice: type.price, lineTotal: type.price.mul(line.quantity) };
  });

  const people = pricedItems.reduce((n, l) => n + l.quantity, 0);

  const pricedAddOns = addOns.map((line) => {
    const addOn = addOnById.get(line.addOnId);
    if (!addOn || !addOn.is_active) {
      throw new BusinessError(422, "add_on_unavailable", { addOnId: line.addOnId.toString() });
    }
    if (addOn.currency !== "LAK") throw new BusinessError(500, "non_lak_price", { addOnId: addOn.id.toString() });
    if (addOn.unit === "per_booking" && line.quantity !== 1) {
      throw new BusinessError(422, "add_on_quantity_invalid", { addOnId: addOn.id.toString(), max: 1 });
    }
    if (addOn.unit === "per_person" && line.quantity > people) {
      throw new BusinessError(422, "add_on_quantity_invalid", { addOnId: addOn.id.toString(), max: people });
    }
    return { addOnId: addOn.id, quantity: line.quantity, unitPrice: addOn.price, lineTotal: addOn.price.mul(line.quantity) };
  });

  const subtotal = [...pricedItems, ...pricedAddOns].reduce((sum, l) => sum.add(l.lineTotal), new Prisma.Decimal(0));
  const discount = new Prisma.Decimal(0);
  return { items: pricedItems, addOns: pricedAddOns, people, subtotal, discount, total: subtotal.sub(discount) };
}

// ຂໍ້ຕົກລົງ 50: ລາຄາປ່ຽນລະຫວ່າງທີ່ຜູ້ໃຊ້ເບິ່ງໜ້າ → ບໍ່ຄິດເງິນລາຄາທີ່ຜູ້ໃຊ້ບໍ່ໄດ້ເຫັນ
// ສົ່ງຍອດເກົ່າ ແລະ ຍອດໃໝ່ ໃຫ້ UI ບອກຊັດ (ບໍ່ແມ່ນແຕ່ "ລາຄາປ່ຽນ")
export function assertExpectedTotal(q: Quote, expectedTotal: number): void {
  if (!q.total.eq(expectedTotal)) {
    throw new BusinessError(409, "price_changed", { expectedTotal: String(expectedTotal), total: q.total.toFixed(0) });
  }
}
