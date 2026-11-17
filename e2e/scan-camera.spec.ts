import path from "node:path";
import { expect, request as pwRequest, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { withDb } from "./db";
import { loginAs, paidBookingForToday, writeQrY4m } from "./helpers";

// ກ້ອງປອມຂອງ Chrome ສະແດງວິດີໂອທີ່ມີ QR ຂອງປີ້ທົດສອບ → ທົດສອບການອ່ານ QR ຈາກກ້ອງແທ້ (ບໍ່ແມ່ນພິມລະຫັດ)
const Y4M = path.join(__dirname, "..", "test-results", "e2e-qr.y4m");
let booking: { code: string; token: string };

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext({ baseURL: "http://localhost:3107" });
  booking = await paidBookingForToday(ctx);
  await ctx.dispose();
  writeQrY4m(Y4M, booking.token);
});

test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${Y4M}`] },
});

test("ກ້ອງອ່ານ QR → ຂຽວເຕັມຈໍ + ປະເພດປີ້ · ສະແກນອີກຄັ້ງ → ແດງ 'ໃຊ້ແລ້ວ'", async ({ page }) => {
  await loginAs(page, "scanner");
  await expect(page).toHaveURL(/\/staff\/scan$/);
  await expect(page.getByText("ປະຕູ: main")).toBeVisible(); // 1 ປະຕູ → ເລືອກເອງ (ຂໍ້ຕົກລົງ 35)
  await expect(page.getByRole("button", { name: "ອອກຈາກລະບົບ" })).toBeVisible();

  const overlay = page.getByRole("alert").filter({ hasText: booking.code });
  await expect(overlay).toContainText("ປີ້ຖືກຕ້ອງ ເຂົ້າໄດ້", { timeout: 20_000 });
  await expect(overlay).toContainText("ຕ່າງປະເທດ"); // ຂໍ້ຕົກລົງ 23
  await expect(overlay).toContainText("ຜູ້ໃຫຍ່ 2");
  expect(await overlay.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(21, 128, 61)"); // success
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  const row = await withDb(async (conn) => {
    const [r] = await conn.query(
      `SELECT b.status, c.result, c.gate, u.username FROM bookings b JOIN check_ins c ON c.booking_id = b.id
       JOIN users u ON u.id = c.scanned_by WHERE b.booking_code = ? ORDER BY c.id LIMIT 1`,
      [booking.code],
    );
    return r;
  });
  expect(row).toMatchObject({ status: "used", result: "ok", gate: "main", username: "e2e_scanner" });

  // ຜ່ານ → ກັບໄປສະແກນເອງ · QR ຍັງຢູ່ໜ້າກ້ອງ → ອ່ານອີກ (ຫຼັງ 4 ວິ) → ຊ້ຳ
  const duplicate = page.getByRole("alert").filter({ hasText: "ປີ້ນີ້ຖືກໃຊ້ແລ້ວ" });
  await expect(duplicate).toBeVisible({ timeout: 20_000 });
  await expect(duplicate).toContainText(/ສະແກນເມື່ອ \d{2}:\d{2} · ປະຕູ main/);
  expect(await duplicate.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(185, 28, 28)"); // destructive
  await page.waitForTimeout(3000);
  await expect(duplicate).toBeVisible(); // ບໍ່ຜ່ານ → ຕ້ອງແຕະ ບໍ່ຫາຍເອງ
  await page.getByRole("button", { name: "ສະແກນຕໍ່" }).click();
});
