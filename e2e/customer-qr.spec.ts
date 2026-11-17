import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { paidBookingForToday } from "./helpers";

test("ໜ້າປີ້ຂອງລູກຄ້າ: QR + ລະຫັດຕົວໃຫຍ່ · ເປີດໄດ້ຕອນ offline · ໜ້າອື່ນບໍ່ cache", async ({ page, context }) => {
  const { code } = await paidBookingForToday(page.request);
  await page.goto(`/lo/booking/${code}`);
  const qr = page.getByRole("img", { name: `QR ປີ້ເຂົ້າຊົມ ${code}` });
  await expect(qr).toBeVisible();
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(240);
  await expect(page.getByText(code, { exact: true }).last()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  await expect
    .poll(() => page.evaluate(async (p) => !!(await navigator.serviceWorker.ready) && !!(await caches.match(p)), `/lo/booking/${code}`))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("img", { name: `QR ປີ້ເຂົ້າຊົມ ${code}` })).toBeVisible();

  // ຂໍ້ຕົກລົງ 34: ສະເພາະ 2 ໜ້າ — ໜ້າຫຼັກບໍ່ຖືກ cache
  await expect(page.goto("/lo")).rejects.toThrow(/ERR_INTERNET_DISCONNECTED/);
  await context.setOffline(false);
});
