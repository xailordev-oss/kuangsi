import { expect, request as pwRequest, test } from "@playwright/test";
import { expectLaoTextNotClipped } from "./checks";
import { withDb } from "./db";
import { loginAs, paidBookingForToday } from "./helpers";

// ຂໍ້ຕົກລົງ 39: offline ສະແກນໄດ້ ແຕ່ສີຕ້ອງຕ່າງ · ຊ້ຳຕອນ sync → ຂຶ້ນລາຍການໃຫ້ກວດ ຫ້າມປະຖິ້ມງຽບໆ
test.use({ permissions: ["camera"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

let booking: { code: string; token: string };
test.beforeAll(async () => {
  const ctx = await pwRequest.newContext({ baseURL: "http://localhost:3107" });
  booking = await paidBookingForToday(ctx);
  await ctx.dispose();
});

test("offline: ເປີດໜ້າໄດ້ · ສີຟ້າ 'ຍັງບໍ່ໄດ້ກວດ' · sync ພົບຊ້ຳ → ລາຍການຕ້ອງກວດ", async ({ page, context }) => {
  await loginAs(page, "scanner");
  await expect(page.getByText(/ລາຍການປີ້ອັບເດດ \d{2}:\d{2}/)).toBeVisible();
  // ລໍ service worker + ໜ້າຖືກເກັບໃນ cache (ຂໍ້ຕົກລົງ 34)
  await expect
    .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.ready) && !!(await caches.match("/staff/scan"))))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("ປະຕູ: main")).toBeVisible(); // ໜ້າມາຈາກ cache
  await expect(page.getByText("ອອບລາຍ", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ໃສ່ລະຫັດເອງ" }).click();
  await page.getByRole("textbox", { name: "ໃສ່ລະຫັດຈອງ" }).fill(booking.code);
  await page.getByRole("button", { name: "ກວດປີ້" }).click();
  const offlineOk = page.getByRole("alert").filter({ hasText: "OFFLINE — ຍັງບໍ່ໄດ້ກວດກັບ server" });
  await expect(offlineOk).toBeVisible();
  await expect(offlineOk).toContainText("ຜູ້ໃຫຍ່ 2");
  expect(await offlineOk.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(29, 78, 216)"); // ບໍ່ແມ່ນສີຂຽວ
  await expectLaoTextNotClipped(page);
  await page.getByRole("button", { name: /ສະແກນຕໍ່/ }).click();
  await expect(page.getByText("ລໍສົ່ງ: 1")).toBeVisible();

  // ບໍ່ພົບໃນລາຍການ → ສີເຫຼືອງ ແລະ ບໍ່ເຂົ້າຄິວ sync
  await page.getByRole("button", { name: "ໃສ່ລະຫັດເອງ" }).click();
  await page.getByRole("textbox", { name: "ໃສ່ລະຫັດຈອງ" }).fill("KS-ZZZZ2");
  await page.getByRole("button", { name: "ກວດປີ້" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "OFFLINE — ບໍ່ພົບໃນລາຍການມື້ນີ້" })).toBeVisible();
  await page.getByRole("button", { name: "ສະແກນຕໍ່" }).click();
  await expect(page.getByText("ລໍສົ່ງ: 1")).toBeVisible();

  // ລະຫວ່າງນັ້ນ ອີກປະຕູໃຫ້ປີ້ນີ້ເຂົ້າແລ້ວ (online)
  await withDb(async (conn) => {
    const [b] = await conn.query("SELECT id FROM bookings WHERE booking_code = ?", [booking.code]);
    const [u] = await conn.query("SELECT id FROM users WHERE username = 'e2e_admin'");
    await conn.query("INSERT INTO check_ins (booking_id, gate, scanned_by, result) VALUES (?, 'main', ?, 'ok')", [b.id, u.id]);
    await conn.query("UPDATE bookings SET status = 'used' WHERE id = ?", [b.id]);
  });

  await context.setOffline(false);
  const review = page.getByRole("alert").filter({ hasText: "ຕ້ອງກວດ (1)" });
  await expect(review).toBeVisible({ timeout: 15_000 });
  await expect(review).toContainText(booking.code);
  await expect(review).toContainText("ປີ້ນີ້ຖືກໃຊ້ແລ້ວ");
  await expect(page.getByText(/ລໍສົ່ງ:/)).toHaveCount(0);

  const logged = await withDb(async (conn) =>
    conn.query(
      "SELECT c.result, c.note FROM check_ins c JOIN bookings b ON b.id = c.booking_id WHERE b.booking_code = ? AND c.note LIKE 'offline_sync:%'",
      [booking.code],
    ),
  );
  expect(logged).toHaveLength(1);
  expect(logged[0].result).toBe("duplicate");

  // ລາຍການຄ້າງຢູ່ຈົນກວ່າພະນັກງານກົດຮັບຮູ້ (ລວມທັງຫຼັງ reload)
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "ຕ້ອງກວດ (1)" })).toBeVisible();
  await page.getByRole("button", { name: "ຮັບຮູ້ແລ້ວ" }).click();
  await expect(page.getByText(/ຕ້ອງກວດ/)).toHaveCount(0);
});
