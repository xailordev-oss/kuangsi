import { errorResponse, jsonError, parseJsonBody } from "@/lib/api";
import { updateUser, updateUserSchema } from "@/lib/admin/users";
import { requirePermission } from "@/lib/auth/dal";
import { clientIp } from "@/lib/rate-limit";

// PATCH /api/admin/users/:id — ປ່ຽນບົດບາດ · ປິດ/ເປີດບັນຊີ · ຕັ້ງລະຫັດໃໝ່ · ປົດລັອກ (ຫ້າມລຶບ — CLAUDE.md ພາກ 4)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("users.manage");
    const { id } = await params;
    if (!/^\d{1,19}$/.test(id)) return jsonError(404, "user_not_found");
    const body = await parseJsonBody(req, updateUserSchema);
    if (!body.ok) return body.response;
    const result = await updateUser(BigInt(id), body.data, { id: admin.id, ip: clientIp(req.headers) });
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
