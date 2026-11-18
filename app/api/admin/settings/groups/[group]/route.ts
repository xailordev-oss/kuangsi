import { settingsMutation } from "@/lib/admin/route";
import { groupBodySchema, isSettingGroup, saveSettingsGroup } from "@/lib/admin/settings";
import { jsonError } from "@/lib/api";

// PUT /api/admin/settings/groups/:group — ບັນທຶກກຸ່ມຄ່າໃນ settings (online · capacity · bank · pos · system)
export async function PUT(req: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  if (!isSettingGroup(group)) return jsonError(404, "not_found");
  return settingsMutation(req, groupBodySchema(group), (body, actor) => saveSettingsGroup(group, body.values, body.confirm ?? false, actor));
}
