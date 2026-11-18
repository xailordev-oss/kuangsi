import { settingsMutation } from "@/lib/admin/route";
import { hoursSchema, saveOperatingHours } from "@/lib/admin/settings";

// PUT /api/admin/settings/hours — ເວລາເປີດ-ປິດ 7 ວັນ · ປິດ/ຫຍໍ້ວັນທີ່ມີການຈອງ → 409 confirm_required
export async function PUT(req: Request) {
  return settingsMutation(req, hoursSchema, (body, actor) => saveOperatingHours(body, actor));
}
