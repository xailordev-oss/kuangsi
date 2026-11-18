import { parseId, settingsMutation } from "@/lib/admin/route";
import { deleteHoliday } from "@/lib/admin/settings";
import { jsonError } from "@/lib/api";

// DELETE /api/admin/settings/holidays/:id — ລຶບໄດ້ສະເພາະມື້ນີ້ / ອະນາຄົດ (ຄຳຖາມ B2) · ບັນທຶກ audit
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return jsonError(404, "not_found");
  return settingsMutation(req, null, (_, actor) => deleteHoliday(id, actor));
}
