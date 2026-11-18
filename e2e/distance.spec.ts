import { expect, test, type Page } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { withDb } from "./db";

// Phase 9 (requirements ພາກ 4): ຂໍ GPS ສະເພາະຕອນກົດ · ສົ່ງແຕ່ພິກັດທີ່ປັດແລ້ວ · ປະຕິເສດ → ເລືອກບ່ອນພັກ
// ບໍ່ມີ ORS_API_KEY → ຄ່າປະມານ (ເສັ້ນຊື່ × 1.5) ພ້ອມປ້າຍ "ຕົວເລກປະມານ"
const NEAR_TOWN = { latitude: 19.887654, longitude: 102.135432, accuracy: 20 };
const HAS_KEY = Boolean(process.env.ORS_API_KEY?.trim());

async function countGeolocationCalls(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { geoCalls: number };
    w.geoCalls = 0;
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args: Parameters<Geolocation["getCurrentPosition"]>) => {
      w.geoCalls++;
      return original(...args);
    };
  });
}
const geoCalls = (page: Page) => page.evaluate(() => (window as unknown as { geoCalls: number }).geoCalls);

test("ບໍ່ຂໍ GPS ຕອນເປີດໜ້າ · ກົດແລ້ວຈຶ່ງຂໍ · ສົ່ງພິກັດປັດ 2 ທົດສະນິຍົມ · ສະແດງ ກມ + ເວລາ + ລິ້ງນຳທາງ", async ({ page, context }) => {
  await countGeolocationCalls(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(NEAR_TOWN);
  await page.goto("/lo");
  await page.waitForLoadState("networkidle");
  expect(await geoCalls(page)).toBe(0);
  await expect(page.getByText("ເພື່ອຄຳນວນໄລຍະທາງ ແລະ ເວລາເດີນທາງໃຫ້ທ່ານ", { exact: false })).toBeVisible();

  const request = page.waitForRequest("**/api/public/distance");
  await page.getByRole("button", { name: "ໄລຍະທາງຈາກບ່ອນຂ້ອຍ" }).click();
  // ຂໍ້ຕົກລົງ 7: ພິກັດແທ້ (6 ທົດສະນິຍົມ) ບໍ່ອອກຈາກເຄື່ອງ
  expect((await request).postDataJSON()).toEqual({ lat: 19.89, lng: 102.14 });
  expect(await geoCalls(page)).toBe(1);

  const result = page.getByTestId("distance-result");
  await expect(result.getByText(/^ທ່ານຢູ່ຫ່າງ \d+\.\d ກມ$/)).toBeVisible();
  await expect(result.getByText(/^ຂັບລົດປະມານ \d+ (ນາທີ|ຊມ \d+ ນາທີ)$/)).toBeVisible();
  await expect(result.getByText("ໃກ້ — ໄປກັບໄດ້ໃນວັນດຽວ")).toBeVisible();
  if (!HAS_KEY) await expect(result.getByText("ຕົວເລກປະມານ", { exact: true })).toBeVisible();
  const google = await result.getByRole("link", { name: /Google Maps/ }).getAttribute("href");
  expect(google).toContain("destination=19.74917,101.99167");
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  // ບໍ່ເກັບພິກັດແທ້: ທຸກ key ໃນ route_cache ເປັນ 2 ທົດສະນິຍົມ
  const keys = await withDb(async (conn) => (await conn.query("SELECT origin_key FROM route_cache")).map((r: { origin_key: string }) => r.origin_key));
  for (const k of keys) expect(k).toMatch(/^-?\d+\.\d{2},-?\d+\.\d{2}$/);
});

test("ປະຕິເສດ GPS → ຂໍ້ຄວາມສຸພາບ + ເລືອກບ່ອນພັກຈາກ places ແທນ", async ({ page }) => {
  await page.goto("/lo");
  await page.getByRole("button", { name: "ໄລຍະທາງຈາກບ່ອນຂ້ອຍ" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /ເລືອກບ່ອນພັກຂອງທ່ານແທນ/ })).toBeVisible();
  await page.getByLabel("ຫຼື ເລືອກບ່ອນພັກ / ສະຖານທີ່").selectOption({ label: "ສະໜາມບິນສາກົນຫຼວງພະບາງ" });
  await expect(page.getByTestId("distance-result").getByText(/^ສະໜາມບິນສາກົນຫຼວງພະບາງ ຫ່າງ \d+\.\d ກມ$/)).toBeVisible();
  await expectLaoTextNotClipped(page);
});

test("ຢູ່ທີ່ຕາດແລ້ວ (< 1 ກມ) → 'ທ່ານຢູ່ທີ່ຕາດກວາງຊີແລ້ວ' + ປຸ່ມເປີດປີ້ · ບໍ່ເອີ້ນ API", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 19.7495, longitude: 101.992, accuracy: 15 });
  let apiCalls = 0;
  page.on("request", (r) => void (r.url().includes("/api/public/distance") && apiCalls++));
  await page.goto("/lo");
  await page.getByRole("button", { name: "ໄລຍະທາງຈາກບ່ອນຂ້ອຍ" }).click();
  await expect(page.getByText("ທ່ານຢູ່ທີ່ຕາດກວາງຊີແລ້ວ")).toBeVisible();
  await expect(page.getByRole("link", { name: "ເປີດປີ້ຂອງຂ້ອຍ" })).toHaveAttribute("href", "/lo/lookup");
  expect(apiCalls).toBe(0);
});

test("ຢູ່ໄກ (ບາງກອກ) → ໄລຍະຈາກຕົວເມືອງຫຼວງພະບາງ + ແນະນຳ · GPS ບໍ່ແມ່ນຍຳ → ປ້າຍປະມານ", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.7563, longitude: 100.5018, accuracy: 2500 });
  await page.goto("/en");
  await page.getByRole("button", { name: "Distance from me" }).click();
  const result = page.getByTestId("distance-result");
  await expect(result.getByText("You're far away — this is the distance from Luang Prabang town")).toBeVisible();
  await expect(result.getByText("Weak GPS signal (±2500 m) — figures are approximate")).toBeVisible();
  await expect(result.getByText("Approximate", { exact: true })).toBeVisible();
  // ໄລຍະຈາກຕົວເມືອງ → ໃຫ້ແອັບແຜນທີ່ໃຊ້ຕຳແໜ່ງຂອງເຄື່ອງເອງ (ບໍ່ໃສ່ origin)
  expect(await result.getByRole("link", { name: /Google Maps/ }).getAttribute("href")).not.toContain("origin=");
});

test("ເນັດຂາດ → ເສັ້ນຊື່ຢ່າງດຽວ ພ້ອມປ້າຍ 'ເສັ້ນຊື່'", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(NEAR_TOWN);
  await page.goto("/lo");
  await page.route("**/api/public/distance", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "ໄລຍະທາງຈາກບ່ອນຂ້ອຍ" }).click();
  const result = page.getByTestId("distance-result");
  await expect(result.getByText("ເສັ້ນຊື່ (ບໍ່ມີອິນເຕີເນັດ) — ບໍ່ແມ່ນໄລຍະຖະໜົນ")).toBeVisible();
  await expect(result.getByText("ຕົວເລກປະມານ", { exact: true })).toBeVisible();
  await expect(result.getByText(/^ຂັບລົດ/)).toHaveCount(0);
});
