import { settingsMutation } from "@/lib/admin/route";
import { addPlace, placeSchema } from "@/lib/admin/reference-data";

// POST /api/admin/settings/places — ເພີ່ມສະຖານທີ່ (ໄລຍະທາງ = NULL ລໍ npm run places:routes)
export async function POST(req: Request) {
  return settingsMutation(req, placeSchema, (body, actor) => addPlace(body, actor), 201);
}
