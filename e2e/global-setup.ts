import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import { E2E_SETTINGS, E2E_USERS, withDb } from "./db";

export const SNAPSHOT = join(__dirname, "..", "test-results", "e2e-settings-snapshot.json");
export const STAFF_SECRET = join(__dirname, "..", "test-results", "e2e-staff.json");

// ເປີດຈອງ online ຊົ່ວຄາວ (ຂໍ້ຕົກລົງ 28) + ຂະຫຍາຍ rate limit — ເກັບຄ່າເດີມໄວ້ໃຫ້ teardown ຄືນ
// ບັນຊີ cashier ສຳລັບ e2e: ລະຫັດສຸ່ມທຸກຮອບ · teardown ປິດບັນຊີ (ຫ້າມລຶບ user — CLAUDE.md ພາກ 4)
export default async function globalSetup() {
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  await withDb(async (conn) => {
    const keys = Object.keys(E2E_SETTINGS);
    const rows: { setting_key: string; setting_value: string }[] = await conn.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?)",
      [keys],
    );
    if (rows.length !== keys.length) throw new Error(`missing settings rows: expected ${keys.length}, got ${rows.length}`);
    writeFileSync(SNAPSHOT, JSON.stringify(Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]))), "utf8");
    for (const [key, value] of Object.entries(E2E_SETTINGS)) {
      await conn.query("UPDATE settings SET setting_value = ? WHERE setting_key = ?", [value, key]);
    }

    const password = randomBytes(12).toString("base64url");
    const hash = await bcrypt.hash(password, 10);
    for (const [role, username] of Object.entries(E2E_USERS)) {
      await conn.query(
        `INSERT INTO users (username, email, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), is_active = 1,
           failed_login_count = 0, locked_until = NULL`,
        [username, `${username}@example.invalid`, hash, `ພະນັກງານ E2E ${role}`, role],
      );
    }
    // username = cashier (ໃຊ້ໃນ test ເກົ່າ) · password ດຽວກັນທຸກບົດບາດ
    writeFileSync(STAFF_SECRET, JSON.stringify({ username: E2E_USERS.cashier, password, users: E2E_USERS }), { encoding: "utf8", mode: 0o600 });
  });
}
