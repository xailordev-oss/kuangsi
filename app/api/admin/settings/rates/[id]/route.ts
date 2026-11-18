import { deleteRate } from "@/lib/admin/reference-data";
import { parseId, settingsMutation } from "@/lib/admin/route";
import { jsonError } from "@/lib/api";

// DELETE /api/admin/settings/rates/:id — ສະເພາະອັດຕາທີ່ວັນທີມີຜົນ > ມື້ນີ້ (ຂໍ້ຕົກລົງ 49) · audit
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return jsonError(404, "not_found");
  return settingsMutation(req, null, (_, actor) => deleteRate(id, actor));
}
