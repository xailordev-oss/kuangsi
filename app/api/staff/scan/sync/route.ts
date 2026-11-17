import { errorResponse, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { alreadySynced, assertGate, scanTicket, trustedScanTime, type ScanResult } from "@/lib/scan/check-in";
import { syncSchema } from "@/lib/scan/schemas";

// POST /api/staff/scan/sync — ສົ່ງການສະແກນ offline ທີ່ຄ້າງ (ຂໍ້ຕົກລົງ 39)
// ປະມວນຕາມເວລາສະແກນ · ສົ່ງຊ້ຳໄດ້ (offlineId) · ປີ້ທີ່ຊ້ຳຖືກບັນທຶກເປັນ duplicate ແລະ ສົ່ງກັບໃຫ້ພະນັກງານກວດ
export async function POST(req: Request) {
  try {
    const staff = await requirePermission("checkin.scan");
    const body = await parseJsonBody(req, syncSchema);
    if (!body.ok) return body.response;
    for (const gate of new Set(body.data.items.map((i) => i.gate))) await assertGate(gate);

    const items = [...body.data.items].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
    const results: { offlineId: string; result: ScanResult; bookingCode: string | null; alreadySynced: boolean }[] = [];
    for (const item of items) {
      const prior = await alreadySynced(item.offlineId);
      if (prior) {
        results.push({ offlineId: item.offlineId, result: prior.result, bookingCode: prior.bookings.booking_code, alreadySynced: true });
        continue;
      }
      const outcome = await scanTicket({
        qrToken: item.qrToken,
        bookingCode: item.bookingCode,
        gate: item.gate,
        staffId: staff.id,
        scannedAt: trustedScanTime(item.scannedAt),
        offlineId: item.offlineId,
      });
      results.push({ offlineId: item.offlineId, result: outcome.result, bookingCode: outcome.bookingCode, alreadySynced: false });
    }
    return Response.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
