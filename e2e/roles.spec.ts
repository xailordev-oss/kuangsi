import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped } from "./checks";
import { loginAs } from "./helpers";

// ຂໍ້ຕົກລົງ 40: ບໍ່ມີບົດບາດໃດຂຶ້ນ 404 ຫຼັງ login
test("scanner → ໜ້າສະແກນ", async ({ page }) => {
  await loginAs(page, "scanner");
  await expect(page).toHaveURL(/\/staff\/scan$/);
});

test("admin → dashboard · ເມນູມີທຸກໜ້າ ລວມ POS / ກວດຫຼັກຖານ / ສະແກນ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "ພາບລວມມື້ນີ້" })).toBeVisible();
  for (const name of ["ພາບລວມ", "ການຈອງ", "ລາຍງານ", "ປີ້ຊ້ຳ offline", "ຂາຍປີ້", "ກວດຫຼັກຖານ", "ສະແກນ"]) {
    await expect(page.getByRole("navigation").getByRole("link", { name, exact: true })).toBeAttached();
  }
});

test("viewer → dashboard (ອ່ານຢ່າງດຽວ) · ບໍ່ມີເມນູ POS / ກວດຫຼັກຖານ / ສະແກນ", async ({ page }) => {
  await loginAs(page, "viewer");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "ພາບລວມມື້ນີ້" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ອອກຈາກລະບົບ" })).toBeVisible();
  for (const name of ["ຂາຍປີ້", "ກວດຫຼັກຖານ", "ສະແກນ"]) {
    await expect(page.getByRole("navigation").getByRole("link", { name, exact: true })).toHaveCount(0);
  }
  await expectLaoTextNotClipped(page);
});

test("cashier → ໜ້າ POS · ມີເມນູໄປໜ້າກວດຫຼັກຖານ", async ({ page }) => {
  await loginAs(page, "cashier");
  await expect(page).toHaveURL(/\/staff\/pos$/);
  await expect(page.getByRole("link", { name: "ກວດຫຼັກຖານ" })).toBeVisible();
});
