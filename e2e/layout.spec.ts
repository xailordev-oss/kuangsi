import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";

// ໜ້າທີ່ມີຂໍ້ຄວາມລາວຍາວ ແລະ ໜ້າຟອມ — ກວດທີ່ 375px
const PAGES = [
  { path: "/lo", heading: "ຕາດກວາງຊີ" },
  { path: "/lo/book", heading: "ວັນທີ ແລະ ປີ້" },
  { path: "/lo/book/details", heading: "ຂໍ້ມູນຜູ້ຈອງ" },
  { path: "/lo/lookup", heading: "ຄົ້ນຫາປີ້ຂອງຂ້ອຍ" },
  { path: "/lo/privacy", heading: "ຄວາມເປັນສ່ວນຕົວ" },
  { path: "/lo/booking/KS-ZZZZZ", heading: "ຢືນຢັນວ່າເປັນການຈອງຂອງທ່ານ" },
];

for (const { path, heading } of PAGES) {
  test(`375px ${path}: ບໍ່ເລື່ອນຂ້າງ + ຂໍ້ຄວາມລາວບໍ່ຖືກຕັດ`, async ({ page }, info) => {
    await page.goto(path);
    await expect(page.getByText(heading).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectLaoTextNotClipped(page);
    await info.attach(`screenshot ${path}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}

test("ພາສາອັງກິດ: ລາຄາເປັນ '25,000 LAK' (ຂໍ້ຕົກລົງ 32)", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByText("25,000 LAK").first()).toBeVisible();
  await expect(page.getByText("₭")).toHaveCount(0);
});

test("ພາສາລາວ: ລາຄາເປັນ '25,000 ກີບ' (ຂໍ້ຕົກລົງ 32)", async ({ page }) => {
  await page.goto("/lo");
  await expect(page.getByText("25,000 ກີບ").first()).toBeVisible();
});

// Chrome ບໍ່ມີຂໍ້ມູນວັນທີພາສາລາວໃນ Intl — ເຄີຍສະແດງ "2026 M11" ແລະ "S M T…"
test("ປະຕິທິນ: ເດືອນ ແລະ ຫົວວັນ ເປັນພາສາລາວ", async ({ page }) => {
  const now = new Date();
  const monthYear = new Intl.DateTimeFormat("lo-LA", { month: "long", year: "numeric", timeZone: "Asia/Vientiane" }).format(now);
  await page.goto("/lo/book");
  await expect(page.getByText(monthYear, { exact: true })).toBeVisible();
  await expect(page.getByText(/\d{4} M\d{1,2}/)).toHaveCount(0);
  const firstOpenDay = page.locator("button[aria-pressed]:not([disabled])").first();
  await expect(firstOpenDay).toHaveAttribute("aria-label", /^ວັນ.+ — /);
});
