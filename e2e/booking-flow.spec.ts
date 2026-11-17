import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_BANK, E2E_PHONE, withDb } from "./db";

test.describe.configure({ mode: "serial" });

let bookingCode = "";

test("ຈອງ online ຕັ້ງແຕ່ໜ້າຫຼັກ ຈົນຮອດຂັ້ນ 4 (ລໍຈ່າຍ)", async ({ page }) => {
  await page.goto("/lo");
  await page.getByRole("link", { name: "ຈອງປີ້ເລີຍ" }).click();
  await expect(page).toHaveURL(/\/lo\/book$/);

  // ຂັ້ນ 1: ວັນທີ — ເລືອກມື້ທຳອິດທີ່ຈອງໄດ້ໃນປະຕິທິນ
  const firstOpenDay = page.locator("button[aria-pressed]:not([disabled])").first();
  await expect(firstOpenDay).toBeVisible();
  await firstOpenDay.click();
  await expect(page.getByText(/ວັນເຂົ້າຊົມ:/)).toBeVisible();

  // ກຸ່ມ ຄົນລາວ ເປັນຄ່າເລີ່ມຕົ້ນຂອງພາສາລາວ · ເພີ່ມຜູ້ໃຫຍ່ 2
  await expect(page.getByRole("radio", { name: "ຄົນລາວ" })).toBeChecked();
  const addAdult = page.getByRole("button", { name: /ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່ 1/ });
  await addAdult.click();
  await addAdult.click();
  await expect(page.getByText("2 ຄົນ ·")).toBeVisible();
  await expect(page.getByText("50,000 ກີບ").last()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
  await page.getByRole("button", { name: "ຕໍ່ໄປ" }).click();

  // ຂັ້ນ 2: ສົ່ງຟອມວ່າງ → ເຫັນຂໍ້ຄວາມບອກວິທີແກ້
  await expect(page).toHaveURL(/\/lo\/book\/details$/);
  await page.getByRole("button", { name: "ຕໍ່ໄປ" }).click();
  await expect(page.getByText("ກະລຸນາໃສ່ຊື່ ແລະ ນາມສະກຸນ")).toBeVisible();
  await expect(page.getByText(/ເບີໂທບໍ່ຄົບ/)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  // ຊື່ປະເທດມາຈາກ CLDR ຂອງ server — Chrome ບໍ່ມີຊື່ພາສາລາວໃນ Intl (ເຄີຍສະແດງ "LA")
  await expect(page.getByRole("combobox", { name: "ລະຫັດປະເທດ" })).toContainText("+856 ລາວ");
  await page.getByLabel("ຊື່ ແລະ ນາມສະກຸນ").fill("ທົດສອບ ອັດຕະໂນມັດ");
  await page.getByRole("textbox", { name: "ເບີໂທ" }).fill("020 5555 8888");
  // ສັນຊາດ: ລາວເປັນຄ່າເລີ່ມຕົ້ນ · ຄົ້ນຫາ ແລະ ເລືອກປະເທດອື່ນໄດ້ (ຂໍ້ຕົກລົງ 31)
  const nationality = page.locator("#nationality");
  await expect(nationality).toContainText("ລາວ");
  await expect(nationality).not.toContainText("LA");
  await nationality.click();
  await page.getByPlaceholder("ຄົ້ນຫາປະເທດ").fill("Japan");
  await page.getByRole("button", { name: /ຍີ່ປຸ່ນ|Japan/ }).click();
  await expect(nationality).toContainText(/ຍີ່ປຸ່ນ|Japan/);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "ຕໍ່ໄປ" }).click();

  // ຂັ້ນ 3: ສະຫຼຸບ — ເບີລາວຖືກແປງເປັນ E.164 (ຂໍ້ຕົກລົງ 24)
  await expect(page).toHaveURL(/\/lo\/book\/review$/);
  await expect(page.getByText("ທົດສອບ ອັດຕະໂນມັດ")).toBeVisible();
  await expect(page.getByText(E2E_PHONE)).toBeVisible();
  await expect(page.getByText("ວິທີຈ່າຍເງິນ: ໂອນຜ່ານທະນາຄານ")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0); // ຂໍ້ຕົກລົງ 14: ບໍ່ມີຕົວເລືອກຈ່າຍ
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
  await page.getByRole("button", { name: /ຢືນຢັນການຈອງ · 50,000 ກີບ/ }).click();

  // ຂັ້ນ 4: ລໍຈ່າຍ
  await expect(page).toHaveURL(/\/lo\/booking\/KS-[A-Z0-9]{5}$/);
  bookingCode = page.url().split("/").pop()!;
  await expect(page.getByText("ລໍຖ້າການຈ່າຍເງິນ").first()).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/ກະລຸນາຈ່າຍພາຍໃນ \d{2}:\d{2}/);
  await expect(page.getByText(E2E_BANK.bank_account_number)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
});

test("ພະນັກງານອະນຸມັດ → ໜ້າ 'ຈ່າຍແລ້ວ' ສະແດງລະຫັດຈອງ (QR ມາໃນ Phase 7)", async ({ page }) => {
  test.skip(!bookingCode, "ຕ້ອງການການຈອງຈາກ test ກ່ອນໜ້າ");
  // TODO(Phase 6): ປ່ຽນເປັນການອະນຸມັດຜ່ານໜ້າພະນັກງານ — ດຽວນີ້ຈຳລອງໃນ DB
  await withDb((conn) => conn.query("UPDATE bookings SET status = 'paid', expires_at = NULL WHERE booking_code = ?", [bookingCode]));

  // browser ໃໝ່ (ບໍ່ມີ cookie) → ຕ້ອງຢືນຢັນລະຫັດ + ເບີໂທ (ຂໍ້ຕົກລົງ 19)
  await page.goto(`/lo/booking/${bookingCode}`);
  await expect(page.getByText("ຢືນຢັນວ່າເປັນການຈອງຂອງທ່ານ")).toBeVisible();
  await page.getByRole("link", { name: "ໃສ່ລະຫັດ ແລະ ເບີໂທ" }).click();
  await expect(page.getByLabel("ລະຫັດຈອງ")).toHaveValue(bookingCode);
  await page.getByRole("textbox", { name: "ເບີໂທ" }).fill("20 5555 8888");
  await page.getByRole("button", { name: "ຄົ້ນຫາ" }).click();

  await expect(page).toHaveURL(new RegExp(`/lo/booking/${bookingCode}$`));
  await expect(page.getByText("ຈ່າຍເງິນແລ້ວ ພ້ອມເຂົ້າຊົມ")).toBeVisible();
  await expect(page.getByText("ສະແດງລະຫັດຈອງນີ້ຢູ່ປະຕູທາງເຂົ້າ")).toBeVisible();
  await expect(page.getByText(bookingCode).last()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
});
