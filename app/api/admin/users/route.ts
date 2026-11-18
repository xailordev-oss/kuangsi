import { errorResponse, parseJsonBody } from "@/lib/api";
import { createUser, createUserSchema } from "@/lib/admin/users";
import { requirePermission } from "@/lib/auth/dal";
import { clientIp } from "@/lib/rate-limit";

// POST /api/admin/users — ເພີ່ມຜູ້ໃຊ້ · ຄືນລະຫັດຊົ່ວຄາວເທື່ອດຽວ (ຂໍ້ຕົກລົງ 46)
export async function POST(req: Request) {
  try {
    const admin = await requirePermission("users.manage");
    const body = await parseJsonBody(req, createUserSchema);
    if (!body.ok) return body.response;
    const created = await createUser(body.data, { id: admin.id, ip: clientIp(req.headers) });
    return Response.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
