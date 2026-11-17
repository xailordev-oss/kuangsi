import { existsSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import { E2E_PHONE, E2E_USERS, withDb } from "./db";
import { SNAPSHOT, STAFF_SECRET } from "./global-setup";

const PROOF_DIR = process.env.PROOF_UPLOAD_DIR || path.join(__dirname, "..", "storage", "proofs");

// ຄືນ settings ເດີມ · ລຶບການຈອງ/ການຈ່າຍ/ຮູບ ທີ່ສ້າງດ້ວຍເບີ E2E ເທົ່ານັ້ນ · ປິດບັນຊີ e2e (ບໍ່ລຶບ)
export default async function globalTeardown() {
  await withDb(async (conn) => {
    if (existsSync(SNAPSHOT)) {
      const original: Record<string, string> = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
      for (const [key, value] of Object.entries(original)) {
        await conn.query("UPDATE settings SET setting_value = ? WHERE setting_key = ?", [value, key]);
      }
      rmSync(SNAPSHOT);
    }
    // ການຂາຍ POS ທີ່ບໍ່ມີລູກຄ້າ (customer_id NULL) → ລຶບຕາມພະນັກງານ e2e ທີ່ຂາຍ
    const sellers = Object.values(E2E_USERS);
    await conn.query("DELETE p FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN users u ON u.id = b.created_by WHERE u.username IN (?)", [sellers]);
    await conn.query("DELETE c FROM check_ins c JOIN bookings b ON b.id = c.booking_id JOIN users u ON u.id = b.created_by WHERE u.username IN (?)", [sellers]);
    await conn.query("DELETE b FROM bookings b JOIN users u ON u.id = b.created_by WHERE u.username IN (?)", [sellers]);
    const customers: { id: bigint }[] = await conn.query("SELECT id FROM customers WHERE phone = ?", [E2E_PHONE]);
    for (const { id } of customers) {
      const proofs: { proof_url: string | null }[] = await conn.query(
        "SELECT p.proof_url FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.customer_id = ?",
        [id],
      );
      for (const { proof_url } of proofs) {
        if (proof_url && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(proof_url)) {
          try {
            unlinkSync(path.join(PROOF_DIR, proof_url));
          } catch {
            // ບໍ່ມີໄຟລ໌ — ບໍ່ເປັນຫຍັງ
          }
        }
      }
      await conn.query("DELETE p FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.customer_id = ?", [id]);
      await conn.query("DELETE c FROM check_ins c JOIN bookings b ON b.id = c.booking_id WHERE b.customer_id = ?", [id]);
      await conn.query("DELETE FROM bookings WHERE customer_id = ?", [id]);
      await conn.query("DELETE FROM customers WHERE id = ?", [id]);
    }
    const usernames = Object.values(E2E_USERS);
    await conn.query("DELETE a FROM audit_logs a JOIN users u ON u.id = a.user_id WHERE u.username IN (?)", [usernames]);
    await conn.query("UPDATE users SET is_active = 0 WHERE username IN (?)", [usernames]);
  });
  if (existsSync(STAFF_SECRET)) rmSync(STAFF_SECRET);
}
