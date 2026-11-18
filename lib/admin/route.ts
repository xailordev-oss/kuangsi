import type { z } from "zod";
import type { Actor } from "@/lib/admin/audit";
import { errorResponse, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { clientIp } from "@/lib/rate-limit";

// API ຕັ້ງຄ່າ (10b-2): admin ເທົ່ານັ້ນ · zod · 409 confirm_required = UI ສະແດງຜົນກະທົບ ແລ້ວສົ່ງຄືນພ້ອມ confirm: true
export async function settingsMutation<S extends z.ZodType>(
  req: Request,
  schema: S | null,
  run: (data: z.output<S>, actor: Actor) => Promise<object | void>,
  status = 200,
): Promise<Response> {
  try {
    const admin = await requirePermission("settings.manage");
    let data = undefined as z.output<S>;
    if (schema) {
      const body = await parseJsonBody(req, schema);
      if (!body.ok) return body.response;
      data = body.data;
    }
    const result = await run(data, { id: admin.id, ip: clientIp(req.headers) });
    return Response.json({ ok: true, ...result }, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export function parseId(id: string): bigint | null {
  return /^\d{1,19}$/.test(id) ? BigInt(id) : null;
}
