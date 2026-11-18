import { expect, test, type Page } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_PHONE, withDb } from "./db";
import { loginAs } from "./helpers";

// ຂໍ້ຕົກລົງ 41/42: ຂາຍໜ້າປະຕູ ≤ 30 ວິ · ເງິນສົດ paid ທັນທີ · ລູກຄ້າບໍ່ບັງຄັບ · online ເທົ່ານັ້ນ · ບໍ່ຂາຍຊ້ຳ
// ເວລາເປີດ-ປິດ ຂອງມື້ນີ້ ຖືກປ່ຽນຊົ່ວຄາວ ເພື່ອໃຫ້ test ແລ່ນໄດ້ທຸກເວລາ · afterAll ຄືນຄ່າເດີມ

type Hours = { open_time: string; close_time: string; is_closed: number };
const TODAY_DOW = "DAYOFWEEK(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')) - 1";
let original: Hours;

async function setTodayHours(open: string, close: string) {
  await withDb((conn) => conn.query(`UPDATE operating_hours SET open_time = ${open}, close_time = ${close}, is_closed = 0 WHERE day_of_week = ${TODAY_DOW}`));
}

test.beforeAll(async () => {
  original = await withDb(async (conn) => {
    const [row] = await conn.query(`SELECT TIME_FORMAT(open_time, '%T') AS open_time, TIME_FORMAT(close_time, '%T') AS close_time, is_closed FROM operating_hours WHERE day_of_week = ${TODAY_DOW}`);
    return row as Hours;
  });
  await setTodayHours("'00:00:00'", "'23:59:59'");
});

test.afterAll(async () => {
  await withDb((conn) =>
    conn.query(`UPDATE operating_hours SET open_time = ?, close_time = ?, is_closed = ? WHERE day_of_week = ${TODAY_DOW}`, [
      original.open_time,
      original.close_time,
      original.is_closed,
    ]),
  );
});

async function openPos(page: Page) {
  await loginAs(page, "cashier");
  await expect(page).toHaveURL(/\/staff\/pos$/);
  await expect(page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" })).toBeEnabled();
}

async function bookingRow(code: string) {
  return withDb(async (conn) => {
    const [row] = await conn.query(
      `SELECT b.status, b.channel, b.customer_id, u.username AS seller, b.total_amount,
              (SELECT COUNT(*) FROM payments p WHERE p.booking_id = b.id AND p.method = 'cash' AND p.status = 'success') AS cash_ok,
              (SELECT COUNT(*) FROM check_ins c WHERE c.booking_id = b.id) AS check_ins
       FROM bookings b JOIN users u ON u.id = b.created_by WHERE b.booking_code = ?`,
      [code],
    );
    return row;
  });
}

test("ຂາຍ 1 ກຸ່ມ (ລາວ 2 + ຕ່າງປະເທດ 1) ດ້ວຍເງິນສົດ ≤ 30 ວິນາທີ · paid ທັນທີ · ບໍ່ມີລູກຄ້າ", async ({ page }) => {
  await openPos(page);
  const vh = page.viewportSize()!.height;
  // ມືດຽວ: ຈຸດກາງຂອງປຸ່ມຫຼັກຢູ່ເຄິ່ງລຸ່ມຂອງຈໍ
  for (const name of ["ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່", "ຫຼຸດ ຄົນລາວ — ຜູ້ໃຫຍ່", "ຮັບເງິນ"]) {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    expect(box.y + box.height / 2, name).toBeGreaterThan(vh / 2);
    expect(box.height, name).toBeGreaterThanOrEqual(48);
  }
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  const started = Date.now();
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await page.getByRole("radio", { name: /ຕ່າງປະເທດ/ }).click();
  await page.getByRole("button", { name: "ເພີ່ມ ຕ່າງປະເທດ — ຜູ້ໃຫຍ່" }).click();
  await expect(page.getByTestId("pos-total")).toHaveText("115,000 ກີບ");
  await page.getByRole("button", { name: "ຮັບເງິນ" }).click();
  await page.getByRole("button", { name: "150,000" }).click();
  await expect(page.getByTestId("pos-change")).toHaveText("35,000 ກີບ");
  await page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ/ }).click();
  const code = (await page.getByTestId("pos-code").textContent())!.trim();
  const elapsed = Date.now() - started;
  console.log(`POS: ຂາຍ 1 ກຸ່ມ ໃຊ້ເວລາ ${(elapsed / 1000).toFixed(1)} ວິນາທີ`);
  expect(elapsed).toBeLessThanOrEqual(30_000);

  await expect(page.getByRole("img", { name: `QR ປີ້ເຂົ້າຊົມ ${code}` })).toBeVisible();
  await expect(page.getByText("ຄົນລາວ ຜູ້ໃຫຍ່ × 2")).toBeVisible();
  await expect(page.getByText("ຕ່າງປະເທດ ຜູ້ໃຫຍ່ × 1")).toBeVisible();
  await expect(page.getByText("ສະແກນ QR ນີ້ຢູ່ປະຕູ")).toBeVisible(); // pos_auto_checkin = false
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  const row = await bookingRow(code);
  expect(row).toMatchObject({ status: "paid", channel: "gate", customer_id: null, seller: "e2e_cashier" });
  expect(Number(row.cash_ok)).toBe(1);
  expect(Number(row.check_ins)).toBe(0);
  expect(Number(row.total_amount)).toBe(115_000);
});

test("ໃສ່ຊື່/ເບີ (ບໍ່ບັງຄັບ) → ສ້າງລູກຄ້າ · ປຸ່ມພິມເອີ້ນ window.print · ຂາຍໃໝ່ລ້າງຟອມ", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void (window as unknown as { printed: number }).printed++;
  });
  await openPos(page);
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await page.getByRole("button", { name: "ຮັບເງິນ" }).click();
  await page.getByRole("button", { name: "ພໍດີ" }).click();
  await page.getByRole("button", { name: "ເພີ່ມຊື່ / ເບີໂທ (ບໍ່ບັງຄັບ)" }).click();
  await page.getByLabel("ຊື່", { exact: true }).fill("ທົດສອບ POS");
  await page.getByLabel("ເບີໂທ", { exact: true }).fill(E2E_PHONE.replace("+856", "0"));
  await page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ/ }).click();
  const code = (await page.getByTestId("pos-code").textContent())!.trim();
  await expect(page.getByTestId("pos-change")).toHaveText("0 ກີບ");

  await page.getByRole("button", { name: "ພິມປີ້" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

  const phone = await withDb(async (conn) => {
    const [r] = await conn.query("SELECT c.phone FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.booking_code = ?", [code]);
    return r?.phone;
  });
  expect(phone).toBe(E2E_PHONE);

  await page.getByRole("button", { name: "ຂາຍໃໝ່" }).click();
  await expect(page.getByTestId("pos-total")).toHaveText("0 ກີບ");
  await expect(page.getByRole("button", { name: "ຮັບເງິນ" })).toBeDisabled();
});

test("ເນັດຂາດ → 'ເນັດຂາດ — ຂາຍປີ້ບໍ່ໄດ້ຊົ່ວຄາວ' + ປິດປຸ່ມຂາຍ · ເນັດມາ → ຂາຍໄດ້ຄືນ", async ({ page, context }) => {
  await openPos(page);
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await context.setOffline(true);
  await expect(page.getByRole("alert").filter({ hasText: "ເນັດຂາດ — ຂາຍປີ້ບໍ່ໄດ້ຊົ່ວຄາວ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ຮັບເງິນ" })).toBeDisabled();
  await expectLaoTextNotClipped(page);
  await context.setOffline(false);
  await expect(page.getByText("ເນັດຂາດ — ຂາຍປີ້ບໍ່ໄດ້ຊົ່ວຄາວ")).toBeHidden();
  await expect(page.getByRole("button", { name: "ຮັບເງິນ" })).toBeEnabled();
});

test("ເນັດຂາດກາງທາງຫຼັງ server ບັນທຶກແລ້ວ → 'ລອງສົ່ງອີກຄັ້ງ' ໄດ້ການຂາຍເດີມ (ບໍ່ຂາຍຊ້ຳ)", async ({ page }) => {
  await openPos(page);
  const before = await withDb(async (conn) => Number((await conn.query("SELECT COUNT(*) AS n FROM bookings WHERE channel = 'gate'"))[0].n));
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await page.getByRole("button", { name: "ຮັບເງິນ" }).click();
  await page.getByRole("button", { name: "ພໍດີ" }).click();

  // ຄຳຂໍໄປຮອດ server (ຂາຍແລ້ວ) ແຕ່ຄຳຕອບບໍ່ກັບມາຮອດເຄື່ອງ
  let dropped = false;
  await page.route("**/api/staff/pos/bookings", async (route) => {
    if (dropped) return route.continue();
    dropped = true;
    await route.fetch();
    await route.abort("internetdisconnected");
  });
  await page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ/ }).click();
  await expect(page.getByText(/ບໍ່ແນ່ໃຈວ່າບັນທຶກສຳເລັດບໍ່/)).toBeVisible();
  await expect(page.getByRole("button", { name: "ກັບຄືນ" })).toBeDisabled();
  await page.getByRole("button", { name: "ລອງສົ່ງອີກຄັ້ງ" }).click();
  await expect(page.getByTestId("pos-code")).toBeVisible();

  const after = await withDb(async (conn) => Number((await conn.query("SELECT COUNT(*) AS n FROM bookings WHERE channel = 'gate'"))[0].n));
  expect(after - before).toBe(1);
});

test("ຫຼັງເວລາປິດ: ພາຍໃນ pos_grace_minutes → ແຖບເຕືອນ 'ນອກເວລາເປີດ' ແຕ່ຂາຍໄດ້ · ເລີຍນັ້ນ → ປິດ", async ({ page }) => {
  const minutesSinceMidnight = await withDb(async (conn) => {
    const [r] = await conn.query("SELECT TIME_TO_SEC(TIME(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))) DIV 60 AS m");
    return Number(r.m);
  });
  test.skip(minutesSinceMidnight < 45, "ໃກ້ທ່ຽງຄືນເກີນໄປ ຕັ້ງເວລາປິດກ່ອນໜ້ານີ້ 40 ນາທີບໍ່ໄດ້");

  const closeAgo = (min: number) => `TIME(CONVERT_TZ(UTC_TIMESTAMP() - INTERVAL ${min} MINUTE, '+00:00', '+07:00'))`;
  await setTodayHours("'00:00:00'", closeAgo(10));
  await openPos(page);
  await expect(page.getByRole("status").filter({ hasText: /ນອກເວລາເປີດ \(\d\d:\d\d–\d\d:\d\d\) — ຍັງຂາຍໄດ້ຊົ່ວຄາວ/ })).toBeVisible();
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await page.getByRole("button", { name: "ຮັບເງິນ" }).click();
  await page.getByRole("button", { name: "ພໍດີ" }).click();
  await page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ/ }).click();
  await expect(page.getByTestId("pos-code")).toBeVisible();
  await expectLaoTextNotClipped(page);

  await setTodayHours("'00:00:00'", closeAgo(40));
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "ມື້ນີ້ປິດບໍລິການແລ້ວ ຂາຍປີ້ບໍ່ໄດ້" })).toBeVisible();
  await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
  await expect(page.getByRole("button", { name: "ຮັບເງິນ" })).toBeDisabled();
  await setTodayHours("'00:00:00'", "'23:59:59'");
});

// ຂໍ້ຕົກລົງ 50: ລາຄາປ່ຽນຫຼັງເປີດໜ້າ POS → ບໍ່ຂາຍລາຄາທີ່ຈໍບໍ່ໄດ້ສະແດງ (ເງິນໃນລິ້ນຊັກຕ້ອງກົງກັບລະບົບ)
test("ລາຄາປ່ຽນຫຼັງເປີດໜ້າ → ບໍ່ຂາຍ + ບອກຍອດເກົ່າ/ໃໝ່ · ຈໍໂຫຼດລາຄາໃໝ່ · ຂາຍອີກຄັ້ງໄດ້ລາຄາໃໝ່", async ({ page }) => {
  const [{ price }] = await withDb((c) => c.query("SELECT price FROM ticket_types WHERE code = 'LAO_ADULT'"));
  try {
    await openPos(page);
    await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
    await page.getByRole("button", { name: "ເພີ່ມ ຄົນລາວ — ຜູ້ໃຫຍ່" }).click();
    await expect(page.getByTestId("pos-total")).toHaveText("50,000 ກີບ");
    await withDb((c) => c.query("UPDATE ticket_types SET price = 30000 WHERE code = 'LAO_ADULT'"));

    await page.getByRole("button", { name: "ຮັບເງິນ" }).click();
    await page.getByLabel("ເງິນທີ່ຮັບ").fill("100000");
    await page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "ຍອດເກົ່າ" })).toContainText("ຍອດເກົ່າ 50,000 ກີບ → ຍອດໃໝ່ 60,000 ກີບ");
    await expect(page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ · 60,000 ກີບ/ })).toBeVisible();
    await expect(page.getByTestId("pos-change")).toHaveText("40,000 ກີບ");
    await expectLaoTextNotClipped(page);

    await page.getByRole("button", { name: /^ຢືນຢັນການຂາຍ/ }).click();
    const code = (await page.getByTestId("pos-code").textContent())!.trim();
    expect(Number((await bookingRow(code)).total_amount)).toBe(60_000);
  } finally {
    await withDb((c) => c.query("UPDATE ticket_types SET price = ? WHERE code = 'LAO_ADULT'", [price]));
  }
});
