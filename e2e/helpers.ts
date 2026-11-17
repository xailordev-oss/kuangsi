import { readFileSync, writeFileSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import encodeQR from "qr";
import { E2E_PHONE, withDb, type E2ERole } from "./db";
import { STAFF_SECRET } from "./global-setup";

export function staffCredentials(role: E2ERole) {
  const secret = JSON.parse(readFileSync(STAFF_SECRET, "utf8"));
  return { username: secret.users[role] as string, password: secret.password as string };
}

export async function loginAs(page: Page, role: E2ERole, path = "/staff/login") {
  const { username, password } = staffCredentials(role);
  await page.goto(path);
  await page.getByLabel("ຊື່ຜູ້ໃຊ້").fill(username);
  await page.getByLabel("ລະຫັດຜ່ານ").fill(password);
  await page.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();
}

// ການຈອງຂອງມື້ນີ້ ທີ່ຈ່າຍແລ້ວ (ການອະນຸມັດທົດສອບແລ້ວໃນ payment-flow) — ຄືນ code + qr_token
export async function paidBookingForToday(request: APIRequestContext, quantity = 2): Promise<{ code: string; token: string }> {
  const catalog = await (await request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  // ສ້າງໃນວັນທີທີ່ຈອງໄດ້ ແລ້ວຍ້າຍມາມື້ນີ້ (ມື້ນີ້ອາດເລີຍເວລາປິດແລ້ວ ຂຶ້ນກັບເວລາທີ່ແລ່ນ test)
  const res = await request.post("/api/public/bookings", {
    data: { visitDate: tomorrow, items: [{ ticketTypeId: adult.id, quantity }], customer: { fullName: "ທົດສອບ ສະແກນ", phone: E2E_PHONE } },
  });
  expect(res.status()).toBe(201);
  const code = (await res.json()).bookingCode as string;
  const token = await withDb(async (conn) => {
    await conn.query(
      "UPDATE bookings SET status = 'paid', expires_at = NULL, visit_date = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')) WHERE booking_code = ?",
      [code],
    );
    const [row] = await conn.query("SELECT qr_token FROM bookings WHERE booking_code = ?", [code]);
    return row.qr_token as string;
  });
  return { code, token };
}

// ກ້ອງປອມຂອງ Chrome: ວິດີໂອ y4m (I420) ທີ່ມີ QR ຢູ່ກາງຈໍ
export function writeQrY4m(path: string, text: string, width = 640, height = 480) {
  const bits = encodeQR(text, "raw", { ecc: "medium" });
  const scale = Math.floor(Math.min(width, height) / (bits.length + 8));
  const size = bits.length * scale;
  const x0 = Math.floor((width - size) / 2);
  const y0 = Math.floor((height - size) / 2);
  const y = Buffer.alloc(width * height, 235);
  bits.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++) y.fill(16, (y0 + r * scale + dy) * width + x0 + c * scale, (y0 + r * scale + dy) * width + x0 + (c + 1) * scale);
    }),
  );
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma]);
  writeFileSync(path, Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]));
}
