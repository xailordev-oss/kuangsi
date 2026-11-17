import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { E2E_BANK, withDb } from "./db";

export const SNAPSHOT = join(__dirname, "..", "test-results", "e2e-settings-snapshot.json");

// ເປີດຈອງ online ຊົ່ວຄາວ (ຂໍ້ຕົກລົງ 28) — ເກັບຄ່າເດີມໄວ້ໃຫ້ teardown ຄືນ
export default async function globalSetup() {
  await withDb(async (conn) => {
    const keys = Object.keys(E2E_BANK);
    const rows: { setting_key: string; setting_value: string }[] = await conn.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?)",
      [keys],
    );
    if (rows.length !== keys.length) throw new Error(`missing settings rows: expected ${keys.length}, got ${rows.length}`);
    mkdirSync(dirname(SNAPSHOT), { recursive: true });
    writeFileSync(SNAPSHOT, JSON.stringify(Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]))), "utf8");
    for (const [key, value] of Object.entries(E2E_BANK)) {
      await conn.query("UPDATE settings SET setting_value = ? WHERE setting_key = ?", [value, key]);
    }
  });
}
