import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { STAFF_SECRET } from "./global-setup";

test.describe.configure({ mode: "serial" });

// PNG 1×1 ທີ່ຖືກຕ້ອງ (server ກວດ magic bytes)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

async function createBooking(page: Page): Promise<string> {
  const catalog = await (await page.request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const days = (await (await page.request.get(`/api/public/availability?from=${new Date().toISOString().slice(0, 10)}&to=${new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10)}`)).json()).days;
  const open = days.find((d: { closed: boolean; left: number }) => !d.closed && d.left > 2);
  const res = await page.request.post("/api/public/bookings", {
    data: { visitDate: open.date, items: [{ ticketTypeId: adult.id, quantity: 2 }], customer: { fullName: "ທົດສອບ ຈ່າຍເງິນ", phone: "020 5555 8888" } },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).bookingCode;
}

async function uploadProof(page: Page, code: string) {
  await page.goto(`/lo/booking/${code}`);
  await expect(page.getByText("2. ອັບໂຫຼດຮູບຫຼັກຖານການໂອນ")).toBeVisible();
  // input ອັນທີ 2 = ເລືອກຈາກຄັງຮູບ (ອັນທີ 1 ເປີດກ້ອງ)
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "ຕົວຢ່າງຮູບທີ່ເລືອກ" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "ສົ່ງຫຼັກຖານ" }).click();
  await expect(page.getByText("ລໍພະນັກງານກວດຫຼັກຖານ")).toBeVisible();
  await expect(page.getByText("ການຈອງຂອງທ່ານບໍ່ໝົດອາຍຸ ລະຫວ່າງທີ່ພະນັກງານກວດ")).toBeVisible();
  const img = page.getByRole("img", { name: "ຮູບຫຼັກຖານການໂອນທີ່ທ່ານສົ່ງ" });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("timer")).toHaveCount(0); // ໂມງຢຸດ (ຂໍ້ຕົກລົງ 15)
  await expectLaoTextNotClipped(page);
}

// browser ໃໝ່ (ບໍ່ມີ cookie ສິດ) → ເຂົ້າຜ່ານລະຫັດຈອງ + ເບີໂທ (ຂໍ້ຕົກລົງ 19)
async function openAsCustomer(page: Page, code: string) {
  await page.goto(`/lo/lookup?code=${code}`);
  await page.getByRole("textbox", { name: "ເບີໂທ" }).fill("020 5555 8888");
  await page.getByRole("button", { name: "ຄົ້ນຫາ" }).click();
  await expect(page).toHaveURL(new RegExp(`/lo/booking/${code}$`));
}

async function staffLogin(page: Page) {
  const { username, password } = JSON.parse(readFileSync(STAFF_SECRET, "utf8"));
  await page.goto("/staff/proofs");
  await expect(page).toHaveURL(/\/staff\/login\?callbackUrl=%2Fstaff%2Fproofs/);
  await page.getByLabel("ຊື່ຜູ້ໃຊ້").fill(username);
  await page.getByLabel("ລະຫັດຜ່ານ").fill(password);
  await page.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();
  await expect(page).toHaveURL(/\/staff\/proofs$/);
}

let approvedCode = "";
let rejectedCode = "";

test("ລູກຄ້າອັບໂຫຼດຫຼັກຖານ 2 ການຈອງ", async ({ page }) => {
  approvedCode = await createBooking(page);
  await uploadProof(page, approvedCode);
  rejectedCode = await createBooking(page);
  await uploadProof(page, rejectedCode);
});

test("cashier login ໂດຍບໍ່ມີ callbackUrl → ບໍ່ຂຶ້ນ 404 · ໄປໜ້າ POS", async ({ page }) => {
  const { username, password } = JSON.parse(readFileSync(STAFF_SECRET, "utf8"));
  await page.goto("/staff/login");
  await page.getByLabel("ຊື່ຜູ້ໃຊ້").fill(username);
  await page.getByLabel("ລະຫັດຜ່ານ").fill(password);
  await page.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();
  await expect(page).toHaveURL(/\/staff\/pos$/);
  await expect(page.getByRole("button", { name: "ຮັບເງິນ" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
});

test("login ຜິດ → ຂໍ້ຄວາມລວມ (ຂໍ້ຕົກລົງ 22)", async ({ page }) => {
  await page.goto("/staff/login");
  await page.getByLabel("ຊື່ຜູ້ໃຊ້").fill("e2e_cashier");
  await page.getByLabel("ລະຫັດຜ່ານ").fill("wrong-password-xx");
  await page.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();
  await expect(page.getByText("ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
});

test("ພະນັກງານອະນຸມັດ 1 · ປະຕິເສດ 1 · ລູກຄ້າເຫັນຜົນ", async ({ page, browser }) => {
  test.skip(!approvedCode || !rejectedCode, "ຕ້ອງການການຈອງຈາກ test ກ່ອນໜ້າ");
  const staff = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  await staffLogin(staff);

  await expect(staff.getByRole("button", { name: "ອອກຈາກລະບົບ" })).toBeVisible(); // ຂໍ້ຕົກລົງ 21
  const approveCard = staff.getByRole("article", { name: approvedCode });
  await expect(approveCard).toBeVisible();
  await expect(approveCard.getByText("ຍອດທີ່ຕ້ອງໄດ້: 130,000 ກີບ")).toBeVisible();
  expect(await approveCard.getByRole("img").evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expectNoHorizontalScroll(staff);
  await expectLaoTextNotClipped(staff);

  await approveCard.getByLabel("ເລກອ້າງອີງ (ບໍ່ບັງຄັບ)").fill("E2E-TXN-1");
  await approveCard.getByRole("button", { name: "ອະນຸມັດ" }).click();
  await expect(staff.getByText(`ອະນຸມັດແລ້ວ ${approvedCode}`)).toBeVisible();

  const rejectCard = staff.getByRole("article", { name: rejectedCode });
  await rejectCard.getByRole("button", { name: "ປະຕິເສດ" }).click();
  const dialog = staff.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "ຢືນຢັນການປະຕິເສດ" })).toBeDisabled(); // ຕ້ອງມີເຫດຜົນ
  await dialog.getByRole("button", { name: "ຮູບບໍ່ແຈ້ງ" }).click();
  await dialog.getByRole("button", { name: "ຢືນຢັນການປະຕິເສດ" }).click();
  await expect(staff.getByText(`ປະຕິເສດແລ້ວ ${rejectedCode}`)).toBeVisible();

  // ພາສາອັງກິດ (ຂໍ້ຕົກລົງ 33)
  await staff.getByRole("combobox", { name: "ພາສາ" }).selectOption("en");
  await expect(staff.getByRole("button", { name: "Sign out" })).toBeVisible();
  await staff.getByRole("combobox", { name: "Language" }).selectOption("lo");

  // ລູກຄ້າ: Playwright ໃຫ້ context ໃໝ່ທຸກ test → ເຂົ້າຜ່ານໜ້າຄົ້ນຫາ
  await openAsCustomer(page, approvedCode);
  await expect(page.getByText("ຈ່າຍເງິນແລ້ວ ພ້ອມເຂົ້າຊົມ")).toBeVisible();
  await openAsCustomer(page, rejectedCode);
  await expect(page.getByText(/ຫຼັກຖານບໍ່ຜ່ານ: ຮູບບໍ່ແຈ້ງ/)).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/ກະລຸນາຈ່າຍພາຍໃນ (29|30):\d{2}/); // ໂມງໃໝ່
  await expect(page.getByRole("button", { name: "ເລືອກຈາກຄັງຮູບ" })).toBeVisible(); // ອັບໂຫຼດໃໝ່ໄດ້
  await expectLaoTextNotClipped(page);

  // ອອກຈາກລະບົບ
  await staff.getByRole("button", { name: "ອອກຈາກລະບົບ" }).click();
  await staff.getByRole("dialog").getByRole("button", { name: "ອອກຈາກລະບົບ" }).click();
  await expect(staff).toHaveURL(/\/staff\/login/);
});
