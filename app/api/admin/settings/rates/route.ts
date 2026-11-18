import { settingsMutation } from "@/lib/admin/route";
import { addRate, rateSchema } from "@/lib/admin/reference-data";

// POST /api/admin/settings/rates — ເພີ່ມອັດຕາແລກປ່ຽນ (ເພີ່ມຢ່າງດຽວ — ຄຳຖາມ B3)
export async function POST(req: Request) {
  return settingsMutation(req, rateSchema, (body, actor) => addRate(body, actor), 201);
}
