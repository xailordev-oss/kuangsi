import { parseId, settingsMutation } from "@/lib/admin/route";
import { placeUpdateSchema, updatePlace } from "@/lib/admin/reference-data";
import { jsonError } from "@/lib/api";

// PATCH /api/admin/settings/places/:id — ແກ້ · ປິດ / ເປີດຄືນ (ບໍ່ລຶບ — ຄຳຖາມ B4)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return jsonError(404, "not_found");
  return settingsMutation(req, placeUpdateSchema, (body, actor) => updatePlace(id, body, actor));
}
