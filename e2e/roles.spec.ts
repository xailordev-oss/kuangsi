import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped } from "./checks";
import { loginAs } from "./helpers";

// ຂໍ້ຕົກລົງ 40: ບໍ່ມີບົດບາດໃດຂຶ້ນ 404 ຫຼັງ login
test("scanner → ໜ້າສະແກນ", async ({ page }) => {
  await loginAs(page, "scanner");
  await expect(page).toHaveURL(/\/staff\/scan$/);
});

test("admin → ໜ້າກວດຫຼັກຖານ + ແຈ້ງວ່າໜ້າ admin ຍັງບໍ່ພ້ອມ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/staff\/proofs\?notice=admin-not-ready$/);
  await expect(page.getByText(/ໜ້າ admin ແລະ ລາຍງານ ຍັງບໍ່ພ້ອມໃຊ້ງານ/)).toBeVisible();
});

test("viewer → ໜ້າແຈ້ງວ່າລາຍງານຍັງບໍ່ພ້ອມ (ບໍ່ແມ່ນ 404)", async ({ page }) => {
  await loginAs(page, "viewer");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "ໜ້າລາຍງານຍັງບໍ່ພ້ອມ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ອອກຈາກລະບົບ" })).toBeVisible();
  await expectLaoTextNotClipped(page);
});

test("cashier → ໜ້າກວດຫຼັກຖານ + ແຈ້ງວ່າ POS ຍັງບໍ່ພ້ອມ", async ({ page }) => {
  await loginAs(page, "cashier");
  await expect(page).toHaveURL(/\/staff\/proofs\?notice=pos-not-ready$/);
});
