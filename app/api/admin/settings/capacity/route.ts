import { settingsMutation } from "@/lib/admin/route";
import { capacitySchema, setCapacityOverride } from "@/lib/admin/settings";

// PUT /api/admin/settings/capacity — ຈຳນວນຮັບສະເພາະວັນ (maxVisitors: null = ກັບໄປໃຊ້ຄ່າປົກກະຕິ)
export async function PUT(req: Request) {
  return settingsMutation(req, capacitySchema, (body, actor) => setCapacityOverride(body, actor));
}
