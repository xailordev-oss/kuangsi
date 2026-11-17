import { connection } from "next/server";
import { errorResponse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getIntSetting } from "@/lib/settings";
import { dbTimeToString } from "@/lib/time";

export async function GET() {
  await connection();
  try {
    const [ticketTypes, addOns, hours, holdMinutes] = await Promise.all([
      prisma.ticket_types.findMany({ where: { is_active: true }, orderBy: [{ sort_order: "asc" }, { id: "asc" }] }),
      prisma.add_ons.findMany({ where: { is_active: true }, orderBy: { id: "asc" } }),
      prisma.operating_hours.findMany({ orderBy: { day_of_week: "asc" } }),
      getIntSetting("booking_hold_minutes"),
    ]);

    return Response.json({
      currency: "LAK",
      bookingHoldMinutes: holdMinutes,
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
    });
  } catch (error) {
    return errorResponse(error);
  }
}
