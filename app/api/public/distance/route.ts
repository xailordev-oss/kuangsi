import { z } from "zod";
import { errorResponse, parseJsonBody } from "@/lib/api";
import { distanceToFalls } from "@/lib/geo/road-distance";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { getIntSetting } from "@/lib/settings";

// ຮັບພິກັດທີ່ເຄື່ອງຂອງຜູ້ໃຊ້ປັດແລ້ວ (2 ທົດສະນິຍົມ) — server ປັດຊ້ຳ ແລະ ບໍ່ log ພິກັດ (ຂໍ້ຕົກລົງ 7)
const distanceSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// POST /api/public/distance — ໄລຍະເສັ້ນຊື່ + ໄລຍະຖະໜົນ/ເວລາຂັບລົດ ໄປຕາດກວາງຊີ
export async function POST(req: Request) {
  try {
    // ທຸກຈຸດທີ່ຍັງບໍ່ມີໃນ cache ກິນໂຄຕາຂອງ routing API → ຈຳກັດຕໍ່ IP
    const [limit, windowMinutes] = await Promise.all([
      getIntSetting("distance_lookup_limit_per_ip"),
      getIntSetting("distance_lookup_window_minutes"),
    ]);
    const rate = hitRateLimit(`distance:${clientIp(req.headers)}`, limit, windowMinutes * 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const body = await parseJsonBody(req, distanceSchema);
    if (!body.ok) return body.response;
    return Response.json(await distanceToFalls(body.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
