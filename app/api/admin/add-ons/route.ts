import { addOnCreateSchema, createAddOn } from "@/lib/admin/catalog";
import { adminMutation } from "@/lib/admin/route";

// POST /api/admin/add-ons — ເພີ່ມບໍລິການເສີມ (ຢືນຢັນລາຄາກ່ອນ)
export async function POST(req: Request) {
  return adminMutation("catalog.manage", req, addOnCreateSchema, (body, actor) => createAddOn(body, actor), 201);
}
