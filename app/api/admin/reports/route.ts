import { connection } from "next/server";
import { errorResponse, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { parseReportRange } from "@/lib/admin/report-range";
import { reportSections, toCsv } from "@/lib/admin/report-view";
import { getReport } from "@/lib/admin/stats";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";
import { todayInVientiane } from "@/lib/time";

// GET /api/admin/reports?from&to&groupBy — CSV ຕົວເລກລວມ (P10-4: ບໍ່ມີຊື່ / ເບີໂທ / id_number)
export async function GET(req: Request) {
  await connection();
  try {
    await requirePermission("report.read");
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const range = parseReportRange(params, todayInVientiane());
    if (!range.ok) return jsonError(400, range.error === "tooLong" ? "range_too_long" : "invalid_range");
    const locale = await getStaffLocale();
    const dict = getStaffDictionary(locale);
    const csv = toCsv(reportSections(await getReport(range), dict, locale), dict, [dict.admin.reports.title, `${range.from} – ${range.to}`]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kuangsi-report-${range.from}_${range.to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
