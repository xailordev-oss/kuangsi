import { prisma } from "@/lib/db";
import { getBankTransferInfo, getIntSetting } from "@/lib/settings";
import { dbTimeToString } from "@/lib/time";

export type LocalizedName = { lo: string; en: string; zh: string | null; th: string | null };

export type CatalogTicketType = {
  id: string;
  code: string;
  name: LocalizedName;
  visitorGroup: "lao" | "foreigner";
  ageGroup: "adult" | "child" | "senior" | "free";
  ageMin: number | null;
  ageMax: number | null;
  price: string;
};

export type CatalogAddOn = { id: string; code: string; name: LocalizedName; unit: "per_person" | "per_booking" | "per_item"; price: string };

export type Catalog = {
  currency: "LAK";
  onlineBookingOpen: boolean;
  bookingHoldMinutes: number;
  maxPeoplePerBooking: number;
  maxAdvanceDays: number;
  ticketTypes: CatalogTicketType[];
  addOns: CatalogAddOn[];
  operatingHours: { dayOfWeek: number; open: string; close: string; closed: boolean }[];
};

export async function getCatalog(): Promise<Catalog> {
  const [ticketTypes, addOns, hours, holdMinutes, maxPeople, maxAdvanceDays, bank] = await Promise.all([
    prisma.ticket_types.findMany({ where: { is_active: true }, orderBy: [{ sort_order: "asc" }, { id: "asc" }] }),
    prisma.add_ons.findMany({ where: { is_active: true }, orderBy: { id: "asc" } }),
    prisma.operating_hours.findMany({ orderBy: { day_of_week: "asc" } }),
    getIntSetting("booking_hold_minutes"),
    getIntSetting("max_people_per_booking"),
    getIntSetting("max_advance_days"),
    getBankTransferInfo(),
  ]);

  return {
    currency: "LAK",
    onlineBookingOpen: bank.configured && ticketTypes.length > 0,
    bookingHoldMinutes: holdMinutes,
    maxPeoplePerBooking: maxPeople,
    maxAdvanceDays,
    ticketTypes: ticketTypes.map((t) => ({
      id: t.id.toString(),
      code: t.code,
      name: { lo: t.name_lo, en: t.name_en, zh: t.name_zh, th: t.name_th },
      visitorGroup: t.visitor_group,
      ageGroup: t.age_group,
      ageMin: t.age_min,
      ageMax: t.age_max,
      price: t.price.toFixed(2),
    })),
    addOns: addOns.map((a) => ({
      id: a.id.toString(),
      code: a.code,
      name: { lo: a.name_lo, en: a.name_en, zh: a.name_zh, th: a.name_th },
      unit: a.unit,
      price: a.price.toFixed(2),
    })),
    operatingHours: hours.map((h) => ({
      dayOfWeek: h.day_of_week,
      open: dbTimeToString(h.open_time),
      close: dbTimeToString(h.close_time),
      closed: h.is_closed,
    })),
  };
}
