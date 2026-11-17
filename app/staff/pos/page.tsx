import { redirect } from "next/navigation";

// TODO(Phase 8): ໜ້າ POS ແທ້ — ດຽວນີ້ພາ cashier ໄປໜ້າທີ່ມີຢູ່ແລ້ວ ພ້ອມຂໍ້ຄວາມ (ຫ້າມປະໃຫ້ຂຶ້ນ 404)
export default function PosPlaceholderPage() {
  redirect("/staff/proofs?notice=pos-not-ready");
}
