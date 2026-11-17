import { existsSync, readFileSync, rmSync } from "node:fs";
import { E2E_PHONE, withDb } from "./db";
import { SNAPSHOT } from "./global-setup";

// ຄືນຄ່າ settings ເດີມ ແລະ ລຶບການຈອງທົດສອບ (ລະບຸດ້ວຍເບີ E2E ເທົ່ານັ້ນ — ບໍ່ແຕະຂໍ້ມູນອື່ນ)
export default async function globalTeardown() {
  await withDb(async (conn) => {
    if (existsSync(SNAPSHOT)) {
      const original: Record<string, string> = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
      for (const [key, value] of Object.entries(original)) {
        await conn.query("UPDATE settings SET setting_value = ? WHERE setting_key = ?", [value, key]);
      }
      rmSync(SNAPSHOT);
    }
    const customers: { id: bigint }[] = await conn.query("SELECT id FROM customers WHERE phone = ?", [E2E_PHONE]);
    for (const { id } of customers) {
      await conn.query("DELETE FROM bookings WHERE customer_id = ?", [id]);
      await conn.query("DELETE FROM customers WHERE id = ?", [id]);
    }
  });
}
