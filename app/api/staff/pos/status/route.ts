import { connection } from "next/server";
import { errorResponse } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { getPosWindow } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";

// GET /api/staff/pos/status — ເປີດ / ຜ່ອນຜັນ / ປິດ + ບ່ອນທີ່ເຫຼືອ · ໜ້າ POS ໃຊ້ກວດເນັດນຳ (ຂໍ້ຕົກລົງ 41)
export async function GET() {
  await connection();
  try {
    await requirePermission("pos.sell");
    return Response.json(await getPosWindow(prisma), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
