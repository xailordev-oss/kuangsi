import type { Catalog, CatalogAddOn, CatalogTicketType, LocalizedName } from "@/lib/booking/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/format";

// ໃຊ້ໄດ້ທັງ server ແລະ client (ບໍ່ແຕະ DB)

export function localizedName(name: LocalizedName, lang: Locale): string {
  return name[lang] ?? name.en;
}

export function ageLabel(type: Pick<CatalogTicketType, "ageMin" | "ageMax">, dict: Dictionary): string | null {
  const { ageMin, ageMax } = type;
  if (ageMin !== null && ageMax !== null) return t(dict.booking.ageRange, { min: ageMin, max: ageMax });
  if (ageMin !== null) return t(dict.booking.ageFrom, { min: ageMin });
  if (ageMax !== null) return t(dict.booking.ageUpTo, { max: ageMax });
  return null;
}

export function groupLabel(group: "lao" | "foreigner", dict: Dictionary): string {
  return group === "lao" ? dict.booking.groupLao : dict.booking.groupForeigner;
}

export type DraftSelection = { tickets: Record<string, number>; addOns: Record<string, number> };

export type QuoteLine = { id: string; label: string; quantity: number; unitPrice: number; lineTotal: number };

// ສະແດງຜົນເທົ່ານັ້ນ — server ຄິດລາຄາໃໝ່ຈາກ DB ສະເໝີ (lib/booking/pricing.ts)
export function previewQuote(catalog: Catalog, sel: DraftSelection, lang: Locale) {
  const ticketLines: QuoteLine[] = catalog.ticketTypes
    .filter((tt) => (sel.tickets[tt.id] ?? 0) > 0)
    .map((tt) => {
      const quantity = sel.tickets[tt.id];
      const unitPrice = Number(tt.price);
      return {
        id: tt.id,
        label: localizedName(tt.name, lang),
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    });
  const addOnLines: QuoteLine[] = catalog.addOns
    .filter((a) => (sel.addOns[a.id] ?? 0) > 0)
    .map((a) => {
      const quantity = sel.addOns[a.id];
      const unitPrice = Number(a.price);
      return { id: a.id, label: localizedName(a.name, lang), quantity, unitPrice, lineTotal: unitPrice * quantity };
    });
  const people = ticketLines.reduce((n, l) => n + l.quantity, 0);
  const total = [...ticketLines, ...addOnLines].reduce((n, l) => n + l.lineTotal, 0);
  return { ticketLines, addOnLines, people, total };
}

export function addOnMaxQuantity(addOn: CatalogAddOn, people: number): number {
  if (addOn.unit === "per_booking") return 1;
  if (addOn.unit === "per_person") return people;
  return 99;
}

// ລະຫັດປະເທດທີ່ສະແດງໃນຟອມ — ຊື່ປະເທດມາຈາກ Intl.DisplayNames ຕາມພາສາ (ບໍ່ຕ້ອງແປເອງ)
export const PHONE_COUNTRIES = [
  { code: "LA", callingCode: "856" },
  { code: "TH", callingCode: "66" },
  { code: "VN", callingCode: "84" },
  { code: "CN", callingCode: "86" },
  { code: "KR", callingCode: "82" },
  { code: "JP", callingCode: "81" },
  { code: "US", callingCode: "1" },
  { code: "GB", callingCode: "44" },
  { code: "FR", callingCode: "33" },
  { code: "DE", callingCode: "49" },
  { code: "AU", callingCode: "61" },
] as const;

export const OTHER_COUNTRY = "OTHER";
