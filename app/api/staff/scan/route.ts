import { errorResponse, parseJsonBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { assertGate, scanTicket } from "@/lib/scan/check-in";
import { scanSchema } from "@/lib/scan/schemas";

// POST /api/staff/scan — ສະແກນ online (scanner, admin)
export async function POST(req: Request) {
  try {
    const staff = await requirePermission("checkin.scan");
    const body = await parseJsonBody(req, scanSchema);
    if (!body.ok) return body.response;
    await assertGate(body.data.gate);
    return Response.json(await scanTicket({ ...body.data, staffId: staff.id }));
  } catch (error) {
    return errorResponse(error);
  }
}
