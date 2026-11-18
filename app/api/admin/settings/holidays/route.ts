import { settingsMutation } from "@/lib/admin/route";
import { addHoliday, holidaySchema } from "@/lib/admin/settings";

// POST /api/admin/settings/holidays — ເພີ່ມວັນປິດ / ວັນພິເສດ (ມື້ນີ້ ຫຼື ອະນາຄົດ)
export async function POST(req: Request) {
  return settingsMutation(req, holidaySchema, (body, actor) => addHoliday(body, actor), 201);
}
