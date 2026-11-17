import * as mariadb from "mariadb";

// ເຊື່ອມ DB ໂດຍກົງສຳລັບກຽມ/ລ້າງຂໍ້ມູນທົດສອບ (session ເປັນ UTC ຕາມ CLAUDE.md ພາກ 6)
export async function withDb<T>(fn: (conn: mariadb.Connection) => Promise<T>): Promise<T> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const conn = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    timezone: "Z",
  });
  try {
    await conn.query("SET time_zone = '+00:00'");
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

export const E2E_PHONE = "+8562055558888";
export const E2E_STAFF_USERNAME = "e2e_cashier";
// ບັນຊີ e2e ທຸກບົດບາດ (ລະຫັດສຸ່ມທຸກຮອບ · teardown ປິດ ບໍ່ລຶບ)
export const E2E_USERS = { cashier: "e2e_cashier", scanner: "e2e_scanner", admin: "e2e_admin", viewer: "e2e_viewer" } as const;
export type E2ERole = keyof typeof E2E_USERS;

export const E2E_BANK: Record<string, string> = {
  bank_name: "ທະນາຄານທົດສອບ E2E",
  bank_account_number: "000-E2E-0000",
  bank_account_name: "ບັນຊີທົດສອບ E2E",
  verify_time_note_lo: "ກວດພາຍໃນ 1 ຊົ່ວໂມງ ໃນເວລາເຮັດວຽກ",
  verify_time_note_en: "Checked within 1 hour during opening hours",
  verify_time_note_zh: "E2E zh",
  verify_time_note_th: "E2E th",
};

// settings ທີ່ e2e ປ່ຽນຊົ່ວຄາວ (global-setup ເກັບຄ່າເດີມ · teardown ຄືນ)
// rate limit ນັບຢູ່ໃນ memory ຂອງ server — ຊຸດທົດສອບອື່ນທີ່ແລ່ນກ່ອນໃນ server ດຽວກັນອາດໃຊ້ໂຄຕາຂອງ IP ນີ້ໝົດແລ້ວ
export const E2E_SETTINGS: Record<string, string> = { ...E2E_BANK, booking_create_limit_per_ip: "1000" };
