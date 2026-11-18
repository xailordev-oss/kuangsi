import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_BANK, E2E_PHONE, withDb } from "./db";
import { loginAs } from "./helpers";

// Phase 10b-2: ຕັ້ງຄ່າ — ບັນຊີທະນາຄານ (ຄ່າເກົ່າ-ໃໝ່ + ຢືນຢັນ) · ຈຳນວນຮັບ / ເວລາເປີດ (ເຕືອນ ບໍ່ຫ້າມ) · audit ເກົ່າ-ໃໝ່
const NEW_ACCOUNT = "111-E2E-2222";
const tomorrow = () => new Date(Date.now() + 864e5 + 7 * 36e5).toISOString().slice(0, 10);

test.afterAll(async () => {
  await withDb(async (conn) => {
    await conn.query("UPDATE settings SET setting_value = ? WHERE setting_key = 'bank_account_number'", [E2E_BANK.bank_account_number]);
    await conn.query("DELETE FROM daily_capacity WHERE capacity_date = ? AND time_slot_id IS NULL", [tomorrow()]);
  });
});

async function pendingBooking(request: APIRequestContext, date: string, quantity: number) {
  const catalog = await (await request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const res = await request.post("/api/public/bookings", {
    data: { visitDate: date, items: [{ ticketTypeId: adult.id, quantity }], customer: { fullName: "ທົດສອບ ຕັ້ງຄ່າ", phone: E2E_PHONE }, expectedTotal: Number(adult.price) * quantity },
  });
  expect(res.status()).toBe(201);
}

test("ບັນຊີທະນາຄານ: ສະແດງຄ່າເກົ່າ-ໃໝ່ → ຢືນຢັນ → ບັນທຶກ + audit ເກົ່າ/ໃໝ່ · ຍົກເລີກ = ບໍ່ບັນທຶກ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("navigation").getByRole("link", { name: "ຕັ້ງຄ່າ", exact: true }).click();
  await page.getByRole("combobox", { name: "ເລືອກໝວດ" }).selectOption("bank");
  await expect(page.getByTestId("online-status")).toHaveText("ຈອງ online: ເປີດ");
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  const account = page.getByLabel("ເລກບັນຊີ");
  await account.fill(NEW_ACCOUNT);
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "ຢືນຢັນບັນຊີທະນາຄານ" })).toBeVisible();
  const changes = dialog.getByTestId("confirm-changes");
  await expect(changes).toContainText(`ເກົ່າ: ${E2E_BANK.bank_account_number}`);
  await expect(changes).toContainText(`ໃໝ່: ${NEW_ACCOUNT}`);
  await expectLaoTextNotClipped(page);

  // ຍົກເລີກ → DB ບໍ່ປ່ຽນ
  await dialog.getByRole("button", { name: "ຍົກເລີກ" }).click();
  const read = () => withDb(async (c) => (await c.query("SELECT setting_value v FROM settings WHERE setting_key = 'bank_account_number'"))[0].v);
  expect(await read()).toBe(E2E_BANK.bank_account_number);

  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ຢືນຢັນ ບັນທຶກ" }).click();
  await expect(page.getByRole("status")).toHaveText("ບັນທຶກແລ້ວ");
  expect(await read()).toBe(NEW_ACCOUNT);

  const [audit] = await withDb((c) => c.query("SELECT old_value o, new_value n FROM audit_logs WHERE action = 'settings.bank' ORDER BY id DESC LIMIT 1"));
  const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
  expect(parse(audit.o)).toEqual({ bank_account_number: E2E_BANK.bank_account_number });
  expect(parse(audit.n)).toEqual({ bank_account_number: NEW_ACCOUNT });

  // server ບັງຄັບຢືນຢັນ — ຂ້າມ UI ກໍບັນທຶກບໍ່ໄດ້
  const values = { ...E2E_BANK };
  const res = await page.request.put("/api/admin/settings/groups/bank", { data: { values } });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toBe("confirm_required");
  expect(body.changes).toEqual([{ key: "bank_account_number", old: NEW_ACCOUNT, new: E2E_BANK.bank_account_number }]);
  expect(await read()).toBe(NEW_ACCOUNT);

  await page.getByRole("combobox", { name: "ເລືອກໝວດ" }).selectOption("history");
  await expect(page.getByTestId("history").locator("li").first()).toContainText("ແກ້ບັນຊີທະນາຄານ / ເວລາກວດ");
});

test("ຈຳນວນຮັບສະເພາະວັນ ຕ່ຳກວ່າທີ່ຈອງແລ້ວ → ເຕືອນພ້ອມຈຳນວນ + ຜົນກະທົບ → ຢືນຢັນແລ້ວບັນທຶກໄດ້", async ({ page }) => {
  const date = tomorrow();
  await pendingBooking(page.request, date, 2);
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings?tab=capacity");

  const form = page.locator("form").filter({ has: page.getByLabel("ຈຳນວນຮັບ (ຄົນ)") });
  await form.getByLabel("ວັນທີ").fill(date);
  await form.getByLabel("ຈຳນວນຮັບ (ຄົນ)").fill("1");
  await form.getByRole("button", { name: "ບັນທຶກ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "ຈຳນວນຮັບຕ່ຳກວ່າທີ່ຈອງແລ້ວ" })).toBeVisible();
  await expect(dialog).toContainText(/ຈອງແລ້ວ \d+ ຄົນ/);
  await expect(dialog).toContainText("ການຈອງທີ່ມີຢູ່ບໍ່ຖືກຍົກເລີກ");
  await dialog.getByRole("button", { name: "ຢືນຢັນ ບັນທຶກ" }).click();
  await expect(page.getByTestId(`override-${date}`)).toBeVisible();

  const [audit] = await withDb((c) => c.query("SELECT new_value n FROM audit_logs WHERE action = 'capacity.set' ORDER BY id DESC LIMIT 1"));
  const n = typeof audit.n === "string" ? JSON.parse(audit.n) : audit.n;
  expect(n.maxVisitors).toBe(1);
  expect(n._impact.overbookedDays.people).toBeGreaterThanOrEqual(2);

  await page.getByTestId(`override-${date}`).getByRole("button", { name: "ກັບໄປໃຊ້ຄ່າປົກກະຕິ" }).click();
  await expect(page.getByTestId(`override-${date}`)).toHaveCount(0);
});

test("ປິດວັນໃນອາທິດທີ່ມີການຈອງ → ເຕືອນ (ບໍ່ຫ້າມ) · ຍົກເລີກ = ເວລາເປີດບໍ່ປ່ຽນ", async ({ page }) => {
  const date = tomorrow();
  await pendingBooking(page.request, date, 1);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings?tab=hours");
  const row = page.getByTestId(`dow-${dow}`);
  await row.getByLabel("ປິດທັງວັນ").check();
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "ມີການຈອງໃນວັນທີ່ປ່ຽນເວລາ" })).toBeVisible();
  await expect(dialog).toContainText("ວັນທີ່ຈະປິດ");
  await expect(dialog).toContainText("ລະບົບບໍ່ແຈ້ງລູກຄ້າ");
  await expectLaoTextNotClipped(page);
  await dialog.getByRole("button", { name: "ຍົກເລີກ" }).click();
  const [h] = await withDb((c) => c.query("SELECT is_closed FROM operating_hours WHERE day_of_week = ?", [dow]));
  expect(Number(h.is_closed)).toBe(0);
});

test("ກວດຢູ່ server: ຄ່ານອກຂອບເຂດ → 400 · viewer → 403 + ເຂົ້າໜ້າຕັ້ງຄ່າບໍ່ໄດ້", async ({ page, browser }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  const bad = await page.request.put("/api/admin/settings/groups/system", {
    data: { values: { session_hours: 25, login_max_attempts: 5, login_lockout_minutes: 15, translations_reviewed_zh: false, translations_reviewed_th: false } },
  });
  expect(bad.status()).toBe(400);
  const pastHoliday = await page.request.post("/api/admin/settings/holidays", { data: { date: "2020-01-01", nameLo: "ທົດສອບ", isClosed: true } });
  expect(pastHoliday.status()).toBe(400);

  const ctx = await browser.newContext();
  const viewer = await ctx.newPage();
  await loginAs(viewer, "viewer");
  await expect(viewer).toHaveURL(/\/admin$/);
  expect((await viewer.request.put("/api/admin/settings/groups/online", { data: { values: {} } })).status()).toBe(403);
  await viewer.goto("/admin/settings");
  await expect(viewer).toHaveURL(/\/admin$/);
  await ctx.close();
});

test("ທຸກ tab ເປີດໄດ້ທີ່ 375px · ວັນປິດ ເພີ່ມ/ລຶບ (audit) · ອັດຕາ ຕ້ອງຢືນຢັນ · ສະຖານທີ່ນອກລາວ → 400", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  for (const tab of ["hours", "holidays", "capacity", "online", "bank", "pos", "rates", "places", "system", "history"]) {
    await page.goto(`/admin/settings?tab=${tab}`);
    await expect(page.locator("#tab-title")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectLaoTextNotClipped(page);
  }

  // ວັນໄກໆ ທີ່ບໍ່ມີການຈອງ → ບໍ່ຕ້ອງຢືນຢັນ
  const far = new Date(Date.now() + 700 * 864e5).toISOString().slice(0, 10);
  await withDb((c) => c.query("DELETE FROM holidays WHERE holiday_date = ?", [far]));
  const added = await page.request.post("/api/admin/settings/holidays", { data: { date: far, nameLo: "ວັນທົດສອບ E2E", isClosed: true } });
  expect(added.status()).toBe(201);
  const { id } = await added.json();
  expect((await page.request.post("/api/admin/settings/holidays", { data: { date: far, nameLo: "ຊ້ຳ", isClosed: true } })).status()).toBe(409);
  expect((await page.request.delete(`/api/admin/settings/holidays/${id}`)).status()).toBe(200);
  const actions = await withDb((c) => c.query("SELECT action FROM audit_logs WHERE table_name = 'holidays' AND record_id = ? ORDER BY id", [id]));
  expect(actions.map((a: { action: string }) => a.action)).toEqual(["holiday.create", "holiday.delete"]);

  // ອັດຕາ: ເພີ່ມແລ້ວແກ້ບໍ່ໄດ້ → server ຂໍຢືນຢັນສະເໝີ (ບໍ່ຢືນຢັນ = ບໍ່ບັນທຶກ)
  const rate = await page.request.post("/api/admin/settings/rates", { data: { currency: "USD", lakPerUnit: "21500", effectiveDate: far } });
  expect(rate.status()).toBe(409);
  expect((await rate.json()).impact.kind).toBe("rate");
  const [{ n }] = await withDb((c) => c.query("SELECT COUNT(*) n FROM exchange_rates WHERE effective_date = ?", [far]));
  expect(Number(n)).toBe(0);

  // lat/lng ສະຫຼັບກັນ → ນອກ ສປປ ລາວ
  const place = await page.request.post("/api/admin/settings/places", {
    data: { nameLo: "ທົດສອບ", nameEn: "Test", type: "hotel", lat: 102.13, lng: 19.89 },
  });
  expect(place.status()).toBe(400);
});

test("ອັດຕາແລກປ່ຽນ (ຂໍ້ຕົກລົງ 49): ອະນາຄົດ ແກ້/ແທນທີ່/ລຶບໄດ້ ພ້ອມຄ່າເກົ່າ-ໃໝ່ + audit · ວັນທີຜ່ານມາ ແກ້/ລຶບບໍ່ໄດ້", async ({ page }) => {
  const far = new Date(Date.now() + 650 * 864e5).toISOString().slice(0, 10);
  const PAST = "2020-01-01";
  await withDb(async (c) => {
    await c.query("DELETE FROM exchange_rates WHERE effective_date IN (?, ?) AND (from_currency = 'THB' OR to_currency = 'THB')", [far, PAST]);
    await c.query("INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES ('THB', 'LAK', 600, ?)", [PAST]);
  });
  try {
    await loginAs(page, "admin");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/settings?tab=rates");
    await expect(page.getByTestId(`rate-THB-${PAST}`)).toContainText("ຜ່ານມາແລ້ວ — ແກ້ບໍ່ໄດ້");
    await expect(page.getByTestId(`rate-THB-${PAST}`).getByRole("button", { name: "ແກ້" })).toHaveCount(0);

    const form = page.locator("form").filter({ has: page.getByLabel("ກີບ ຕໍ່ 1 ໜ່ວຍ") });
    await form.getByLabel("ສະກຸນເງິນ").selectOption("THB");
    await form.getByLabel("ກີບ ຕໍ່ 1 ໜ່ວຍ").fill("6500");
    await form.getByLabel("ມີຜົນແຕ່ວັນທີ").fill(far);
    await form.getByRole("button", { name: "ບັນທຶກ" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ຢືນຢັນ ບັນທຶກ" }).click();
    const row = page.getByTestId(`rate-THB-${far}`);
    await expect(row).toContainText("1 THB = 6,500 ກີບ");

    // ພິມຜິດ → ແກ້ຄືນໄດ້ (ແທນທີ່ແຖວເດີມ ບໍ່ສ້າງແຖວໃໝ່)
    await row.getByRole("button", { name: "ແກ້" }).click();
    await form.getByLabel("ກີບ ຕໍ່ 1 ໜ່ວຍ").fill("650");
    await form.getByRole("button", { name: "ບັນທຶກ" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("ເກົ່າ: 1 THB = 6,500 ກີບ");
    await expect(dialog).toContainText("ອັດຕາໃໝ່: 1 THB = 650 ກີບ");
    await dialog.getByRole("button", { name: "ຢືນຢັນ ບັນທຶກ" }).click();
    await expect(row).toContainText("1 THB = 650 ກີບ");

    const rows = await withDb((c) => c.query("SELECT id FROM exchange_rates WHERE effective_date = ? AND from_currency = 'THB'", [far]));
    expect(rows).toHaveLength(1);
    const [audit] = await withDb((c) => c.query("SELECT old_value o, new_value n FROM audit_logs WHERE action = 'exchange_rate.update' AND record_id = ? ORDER BY id DESC LIMIT 1", [rows[0].id]));
    const j = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
    expect(j(audit.o).lakPerUnit).toBe("6500");
    expect(j(audit.n).lakPerUnit).toBe("650");

    // ວັນທີຜ່ານມາ → server ປະຕິເສດ ເຖິງຈະສົ່ງ confirm
    const past = await page.request.post("/api/admin/settings/rates", { data: { currency: "THB", lakPerUnit: "1", effectiveDate: PAST, confirm: true } });
    expect(past.status()).toBe(400);

    // ລຶບ: ອະນາຄົດເທົ່ານັ້ນ (ພິມວັນທີຜິດ) · ຖາມຢືນຢັນ · audit exchange_rate.delete
    await expect(page.getByTestId(`rate-THB-${PAST}`).getByRole("button", { name: "ລຶບ" })).toHaveCount(0);
    await row.getByRole("button", { name: "ລຶບ" }).click();
    await expect(page.getByRole("dialog")).toContainText("1 THB = 650 ກີບ");
    await page.getByRole("dialog").getByRole("button", { name: "ລຶບ" }).click();
    await expect(row).toHaveCount(0);
    const [del] = await withDb((c) => c.query("SELECT old_value o FROM audit_logs WHERE action = 'exchange_rate.delete' AND record_id = ?", [rows[0].id]));
    expect(j(del.o)).toMatchObject({ currency: "THB", lakPerUnit: "650", effectiveDate: far });
    const [pastRow] = await withDb((c) => c.query("SELECT id FROM exchange_rates WHERE effective_date = ? AND from_currency = 'THB'", [PAST]));
    expect((await page.request.delete(`/api/admin/settings/rates/${pastRow.id}`)).status()).toBe(409);
  } finally {
    await withDb((c) => c.query("DELETE FROM exchange_rates WHERE effective_date IN (?, ?) AND (from_currency = 'THB' OR to_currency = 'THB')", [far, PAST]));
  }
});
