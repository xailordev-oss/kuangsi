import { settingsMutation } from "@/lib/admin/route";
import { saveRate, rateSchema } from "@/lib/admin/reference-data";

// POST /api/admin/settings/rates — ເພີ່ມ ຫຼື ແທນທີ່ອັດຕາຂອງມື້ນີ້ / ອະນາຄົດ (ຂໍ້ຕົກລົງ 49)
export async function POST(req: Request) {
  return settingsMutation(req, rateSchema, (body, actor) => saveRate(body, actor));
}
