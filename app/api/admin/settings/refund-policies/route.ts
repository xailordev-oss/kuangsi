import { settingsMutation } from "@/lib/admin/route";
import { policySchema, savePolicy } from "@/lib/refunds/policy-admin";

// PUT /api/admin/settings/refund-policies — ແທນທີ່ຂັ້ນທັງໝົດ (ຢືນຢັນເກົ່າ-ໃໝ່ · audit) — ຂໍ້ຕົກລົງ 53
export async function PUT(req: Request) {
  return settingsMutation(req, policySchema, (body, actor) => savePolicy(body, actor));
}
