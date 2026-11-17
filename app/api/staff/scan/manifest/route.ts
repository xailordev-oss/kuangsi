import { connection } from "next/server";
import { errorResponse } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { scanManifest } from "@/lib/scan/check-in";

// GET /api/staff/scan/manifest — ປີ້ຂອງມື້ນີ້ ໃຫ້ເຄື່ອງສະແກນເກັບໄວ້ກວດຕອນ offline (ຂໍ້ຕົກລົງ 39)
export async function GET() {
  await connection();
  try {
    await requirePermission("checkin.scan");
    return Response.json(await scanManifest(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
