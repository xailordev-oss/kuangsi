import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_PHONE, withDb } from "./db";
import { loginAs } from "./helpers";

// Phase 11 — ຂໍ້ຕົກລົງ 53–58: ຍົກເລີກ + ຄືນເງິນ
test.describe.configure({ mode: "serial" });

type Tier = { hours_before: number; refund_percent: number };
let policy: Tier[] = [];
let todayHours: { open_time: string; close_time: string; is_closed: number } | null = null;
const TODAY_DOW = "DAYOFWEEK(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')) - 1";
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

test.beforeAll(async () => {
  policy = await withDb((c) => c.query("SELECT hours_before, refund_percent FROM refund_policies"));
  todayHours = await withDb(async (c) => (await c.query(`SELECT TIME_FORMAT(open_time, '%T') open_time, TIME_FORMAT(close_time, '%T') close_time, is_closed FROM operating_hours WHERE day_of_week = ${TODAY_DOW}`))[0]);
});

test.afterAll(async () => {
  await withDb(async (c) => {
    await c.query("DELETE FROM refund_policies");
    for (const p of policy) await c.query("INSERT INTO refund_policies (hours_before, refund_percent) VALUES (?, ?)", [p.hours_before, p.refund_percent]);
    if (todayHours) {
      await c.query(`UPDATE operating_hours SET open_time = ?, close_time = ?, is_closed = ? WHERE day_of_week = ${TODAY_DOW}`, [todayHours.open_time, todayHours.close_time, todayHours.is_closed]);
    }
  });
});

const setPolicy = (tiers: [number, number][]) =>
  withDb(async (c) => {
    await c.query("DELETE FROM refund_policies");
    for (const [h, p] of tiers) await c.query("INSERT INTO refund_policies (hours_before, refund_percent) VALUES (?, ?)", [h, p]);
  });

// ການຈອງ online ທີ່ຈ່າຍແລ້ວ (ການອະນຸມັດທົດສອບແລ້ວໃນ payment-flow) — browser ນີ້ໄດ້ cookie ສິດຈາກການຈອງ (ຂໍ້ຕົກລົງ 19)
async function paidOnlineBooking(request: APIRequestContext, minDaysAhead = 3) {
  const catalog = await (await request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const from = new Date(Date.now() + minDaysAhead * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + (minDaysAhead + 25) * 864e5).toISOString().slice(0, 10);
  const open = (await (await request.get(`/api/public/availability?from=${from}&to=${to}`)).json()).days.find((d: { closed: boolean; left: number }) => !d.closed && d.left > 4);
  const total = Number(adult.price) * 2;
  const res = await request.post("/api/public/bookings", {
    data: { visitDate: open.date, items: [{ ticketTypeId: adult.id, quantity: 2 }], customer: { fullName: "ທົດສອບ ຍົກເລີກ", phone: E2E_PHONE }, expectedTotal: total },
  });
  expect(res.status()).toBe(201);
  const code = (await res.json()).bookingCode as string;
  await withDb(async (c) => {
    const [b] = await c.query("SELECT id FROM bookings WHERE booking_code = ?", [code]);
    await c.query("INSERT INTO payments (booking_id, method, amount, currency, status, paid_at) VALUES (?, 'bank_transfer', ?, 'LAK', 'success', UTC_TIMESTAMP())", [b.id, total]);
    await c.query("UPDATE bookings SET status = 'paid', expires_at = NULL WHERE id = ?", [b.id]);
  });
  return { code, total, date: open.date as string };
}

const left = async (request: APIRequestContext, date: string) => (await (await request.get(`/api/public/availability?from=${date}&to=${date}`)).json()).days[0].left as number;
const refundRow = (code: string) =>
  withDb(async (c) => (await c.query("SELECT r.* FROM refunds r JOIN bookings b ON b.id = r.booking_id WHERE b.booking_code = ?", [code]))[0]);
const paymentRow = (code: string) =>
  withDb(async (c) => (await c.query("SELECT p.* FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.booking_code = ? AND p.status IN ('success','refunded')", [code]))[0]);

async function customerCancel(page: Page, code: string, account = "0101-12-345678") {
  await page.goto(`/lo/booking/${code}`);
  await page.getByRole("button", { name: "ຍົກເລີກການຈອງ" }).click();
  await page.getByLabel("ຊື່ທະນາຄານ").fill("ທະນາຄານທົດສອບ");
  await page.getByLabel("ເລກບັນຊີ").fill(account);
  await page.getByLabel("ຊື່ບັນຊີ").fill("ທົດສອບ ຍົກເລີກ");
  await page.getByRole("checkbox", { name: /ຂ້ອຍເຂົ້າໃຈ/ }).check();
}

test("ລູກຄ້າຍົກເລີກ (> 24 ຊມ → 100%) → ລໍຄືນເງິນ · ບ່ອນວ່າງກັບຄືນທັນທີ · ຍັງບໍ່ນັບເປັນເງິນຄືນ", async ({ page }) => {
  await setPolicy([
    [24, 100],
    [12, 50],
  ]);
  const { code, total, date } = await paidOnlineBooking(page.request);
  const before = await left(page.request, date);
  await customerCancel(page, code);
  await expect(page.getByTestId("policy-tiers")).toContainText("ກ່ອນເວລາເປີດ 24 ຊົ່ວໂມງຂຶ້ນໄປ — ຄືນ 100% ◀ ຂັ້ນຂອງທ່ານ");
  await expect(page.getByTestId("refund-amount")).toContainText(`ຈະໄດ້ຄືນ ${fmt(total)} ກີບ (100%)`);
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
  await page.getByRole("button", { name: `ຍົກເລີກ ແລະ ຂໍຄືນ ${fmt(total)} ກີບ` }).click();
  await expect(page.getByTestId("refund-status")).toContainText(`ລໍຄືນເງິນ ${fmt(total)} ກີບ ເຂົ້າບັນຊີ ****5678`);
  await expect(page.getByTestId("refund-status")).toContainText("ພະນັກງານຈະຕິດຕໍ່ກັບ"); // ຂໍ້ຕົກລົງ 56: refund_time_note ຍັງເປັນ TODO

  const r = await refundRow(code);
  expect(r).toMatchObject({ status: "requested", method: "bank_transfer", refund_percent: 100, account_last4: "5678", requested_by: null });
  expect(Number(r.amount)).toBe(total);
  const p = await paymentRow(code);
  expect(p.status).toBe("success"); // ຂໍ້ຕົກລົງ 44: ນັບເປັນຄືນເງິນ ຕອນເງິນອອກແທ້ເທົ່ານັ້ນ
  expect(p.refunded_at).toBeNull();
  expect(await left(page.request, date)).toBe(before + 2);
});

test("% ປ່ຽນລະຫວ່າງເປີດໜ້າ → 409 ບອກເກົ່າ → ໃໝ່ (ບໍ່ຍົກເລີກ) · ຍົກເລີກພ້ອມກັນ 2 ເທື່ອ → ສຳເລັດອັນດຽວ · ຄືນ 1 ແຖວ", async ({ page }) => {
  await setPolicy([[1, 50]]);
  const { code, total } = await paidOnlineBooking(page.request);
  await customerCancel(page, code);
  await expect(page.getByTestId("refund-amount")).toContainText(`ຈະໄດ້ຄືນ ${fmt(total / 2)} ກີບ (50%)`);
  await setPolicy([[1, 100]]);
  await page.getByRole("button", { name: /^ຍົກເລີກ ແລະ ຂໍຄືນ/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ເກົ່າ" })).toContainText(`ເກົ່າ ${fmt(total / 2)} ກີບ → ໃໝ່ ${fmt(total)} ກີບ (100%)`);
  expect((await withDb((c) => c.query("SELECT status FROM bookings WHERE booking_code = ?", [code])))[0].status).toBe("paid");

  const bank = { bankName: "ທົດສອບ", accountNumber: "0101-99-1234", accountName: "ທົດສອບ" };
  const [a, b] = await Promise.all([
    page.request.post(`/api/public/bookings/${code}/cancel`, { data: { expectedAmount: total, bank } }),
    page.request.post(`/api/public/bookings/${code}/cancel`, { data: { expectedAmount: total, bank } }),
  ]);
  expect([a.status(), b.status()].sort()).toEqual([200, 409]);
  expect(Number((await withDb((c) => c.query("SELECT COUNT(*) n FROM refunds r JOIN bookings b ON b.id = r.booking_id WHERE b.booking_code = ?", [code])))[0].n)).toBe(1);
});

test("cashier ໂອນຄືນແລ້ວ → completed ເທື່ອດຽວ · ລ້າງເລກບັນຊີ · payments.refunded_at = ມື້ນີ້ (ຂໍ້ຕົກລົງ 44)", async ({ page, browser }) => {
  await setPolicy([[1, 100]]);
  const ctx = await browser.newContext();
  const customer = await ctx.newPage();
  const { code, total } = await paidOnlineBooking(customer.request);
  const cancel = await customer.request.post(`/api/public/bookings/${code}/cancel`, {
    data: { expectedAmount: total, bank: { bankName: "BCEL", accountNumber: "0101-12-34-9876", accountName: "ທົດສອບ" } },
  });
  expect(cancel.status()).toBe(200);

  await loginAs(page, "cashier");
  await expect(page).toHaveURL(/\/staff\/pos$/);
  await page.getByRole("navigation").getByRole("link", { name: "ຄືນເງິນ", exact: true }).click();
  const card = page.getByTestId(`refund-${code}`);
  await expect(card).toContainText("0101-12-34-9876");
  await expect(card).toContainText(`ຄືນ ${fmt(total)} ກີບ (100%`);
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
  await card.getByLabel("ເລກອ້າງອີງການໂອນຄືນ").fill("TRF-E2E-001");
  await card.getByRole("button", { name: "ໂອນຄືນແລ້ວ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ໂອນຄືນແລ້ວ" }).click();
  await expect(page.getByRole("status")).toHaveText("ບັນທຶກການຄືນເງິນແລ້ວ");
  await expect(card).toHaveCount(0);

  const r = await refundRow(code);
  expect(r).toMatchObject({ status: "completed", account_number: null, account_last4: "9876", transfer_ref: "TRF-E2E-001" });
  const p = await paymentRow(code);
  expect(p.status).toBe("refunded");
  expect(Number(p.refund_amount)).toBe(total);
  expect(p.refunded_at).not.toBeNull();
  const again = await page.request.post(`/api/staff/refunds/${r.id}/complete`, { data: { transferRef: "X" } });
  expect((await again.json()).error).toBe("already_completed");

  await customer.goto(`/lo/booking/${code}`);
  await expect(customer.getByTestId("refund-status")).toContainText(`ຄືນເງິນແລ້ວ ${fmt(total)} ກີບ`);
  await expect(customer.getByTestId("refund-status")).toContainText("ເລກອ້າງອີງ TRF-E2E-001");
  await ctx.close();
});

test("ຄ້າງເກີນ refund_account_retention_days → ລ້າງເລກບັນຊີເຫຼືອ 4 ຕົວທ້າຍ + admin ເຫັນ (ຂໍ້ຕົກລົງ 55)", async ({ page }) => {
  await setPolicy([[1, 100]]);
  const { code, total } = await paidOnlineBooking(page.request);
  await page.request.post(`/api/public/bookings/${code}/cancel`, {
    data: { expectedAmount: total, bank: { bankName: "BCEL", accountNumber: "0101-55-4321", accountName: "ທົດສອບ" } },
  });
  await withDb((c) => c.query("UPDATE refunds r JOIN bookings b ON b.id = r.booking_id SET r.created_at = UTC_TIMESTAMP() - INTERVAL 31 DAY WHERE b.booking_code = ?", [code]));

  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  const stale = page.getByTestId("refund-tiles").getByRole("link", { name: /ຄືນເງິນຄ້າງເກີນ 30 ວັນ/ });
  await expect(stale).toBeVisible();
  expect(await stale.getAttribute("class")).toContain("warning");
  const r = await refundRow(code);
  expect(r.account_number).toBeNull();
  expect(r.account_last4).toBe("4321");
  expect(r.account_purged_at).not.toBeNull();

  await page.goto("/staff/refunds");
  await expect(page.getByTestId(`refund-${code}`)).toContainText("ເລກບັນຊີຖືກລ້າງແລ້ວ (****4321)");
  const audit = await withDb((c) => c.query("SELECT new_value v FROM audit_logs WHERE action = 'refund.account_purge' ORDER BY id DESC LIMIT 1"));
  expect(JSON.stringify(audit[0].v)).not.toContain("0101-55-4321");
});

test("cashier ຍົກເລີກການຂາຍ POS ມື້ນີ້: ເງິນສົດເຕັມ · ເຫດຜົນບັງຄັບ · dashboard ສະແດງສີເຫຼືອງ (ຂໍ້ຕົກລົງ 57)", async ({ page, browser }) => {
  await withDb((c) => c.query(`UPDATE operating_hours SET open_time = '00:00:00', close_time = '23:59:59', is_closed = 0 WHERE day_of_week = ${TODAY_DOW}`));
  await loginAs(page, "cashier");
  await expect(page).toHaveURL(/\/staff\/pos$/);
  const catalog = await (await page.request.get("/api/public/catalog")).json();
  const lao = catalog.ticketTypes.find((t: { code: string }) => t.code === "LAO_ADULT");
  const sale = await page.request.post("/api/staff/pos/bookings", {
    data: { items: [{ ticketTypeId: lao.id, quantity: 2 }], addOns: [], cashReceived: 100000, expectedTotal: Number(lao.price) * 2, requestId: crypto.randomUUID() },
  });
  expect(sale.status()).toBe(201);
  const code = (await sale.json()).booking.bookingCode as string;
  const total = Number(lao.price) * 2;

  await page.goto("/staff/refunds");
  await page.getByTestId(`void-${code}`).getByRole("button", { name: "ຍົກເລີກການຂາຍ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`ຍື່ນເງິນສົດຄືນລູກຄ້າ ${fmt(total)} ກີບ`);
  await expect(dialog.getByRole("button", { name: "ຢືນຢັນ — ຍື່ນເງິນຄືນແລ້ວ" })).toBeDisabled();
  await dialog.getByLabel("ເຫດຜົນ (ບັງຄັບ)").fill("ກົດຈຳນວນຜິດ");
  await dialog.getByRole("button", { name: "ຢືນຢັນ — ຍື່ນເງິນຄືນແລ້ວ" }).click();
  await expect(page.getByRole("status")).toHaveText(`ຍົກເລີກແລ້ວ — ຄືນເງິນສົດ ${fmt(total)} ກີບ`);

  const r = await refundRow(code);
  expect(r).toMatchObject({ status: "completed", method: "cash", refund_percent: 100, reason: "ກົດຈຳນວນຜິດ" });
  expect((await paymentRow(code)).status).toBe("refunded");
  // ບໍ່ມີທາງໃຫ້ cashier ກຳນົດຈຳນວນ — API ຮັບແຕ່ເຫດຜົນ · ສົ່ງຊ້ຳ = ຍົກເລີກແລ້ວ
  expect((await page.request.post(`/api/staff/pos/bookings/${code}/void`, { data: { reason: "ອີກເທື່ອ" } })).status()).toBe(409);
  expect((await page.request.post(`/api/staff/pos/bookings/${code}/void`, { data: { reason: "" } })).status()).toBe(400);
  // cashier ຍົກເລີກການຈອງ online ບໍ່ໄດ້
  expect((await page.request.post(`/api/admin/bookings/${code}/cancel`, { data: { mode: "full", reason: "ທົດສອບ" } })).status()).toBe(403);

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAs(admin, "admin");
  await expect(admin).toHaveURL(/\/admin$/);
  const tile = admin.getByTestId("refund-tiles").locator("div").filter({ hasText: "ຍົກເລີກຢູ່ POS ມື້ນີ້" }).first();
  await expect(tile).toHaveClass(/warning/);
  await expect(tile).toContainText(/[1-9]\d* ລາຍການ/);
  await ctx.close();
});

test("admin: ກຳນົດເອງເກີນຍອດ → 422 · used ຍົກເລີກບໍ່ໄດ້ · ເຕັມ 100% ພ້ອມເຫດຜົນ · viewer 403 · ປິດວັນ → ລາຍການການຈອງ + ລິ້ງ (ຂໍ້ຕົກລົງ 58)", async ({ page, browser }) => {
  await setPolicy([[24, 100]]);
  const ctx = await browser.newContext();
  const customer = await ctx.newPage();
  const { code, total, date } = await paidOnlineBooking(customer.request);
  await ctx.close();

  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  // ປິດວັນທີ່ມີການຈອງ → impact ມີລາຍການການຈອງ
  const holiday = await page.request.post("/api/admin/settings/holidays", { data: { date, nameLo: "ຕາດປິດ E2E", isClosed: true } });
  expect(holiday.status()).toBe(409);
  const impact = (await holiday.json()).impact;
  expect(impact.bookings.map((b: { code: string }) => b.code)).toContain(code);
  const added = await page.request.post("/api/admin/settings/holidays", { data: { date, nameLo: "ຕາດປິດ E2E", isClosed: true, confirm: true } });
  try {
    await page.goto("/admin/settings?tab=holidays");
    const link = page.getByTestId(`holiday-${date}`).getByRole("link", { name: new RegExp(code) });
    await expect(link).toHaveAttribute("href", `/admin/bookings/${code}`);

    expect((await page.request.post(`/api/admin/bookings/${code}/cancel`, { data: { mode: "custom", amount: total + 1, reason: "ທົດສອບເກີນ" } })).status()).toBe(422);
    await page.goto(`/admin/bookings/${code}`);
    await page.getByRole("button", { name: "ຍົກເລີກການຈອງ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /ເຕັມ/ }).check();
    await dialog.getByLabel("ເຫດຜົນ (ບັງຄັບ)").fill("ຕາດປິດຍ້ອນນ້ຳຖ້ວມ");
    await dialog.getByRole("button", { name: "ຢືນຢັນຍົກເລີກ" }).click();
    await expect(page.getByTestId("cancel-info")).toContainText("ຕາດປິດຍ້ອນນ້ຳຖ້ວມ");
    const r = await refundRow(code);
    expect(r).toMatchObject({ status: "requested", refund_percent: 100, policy_hours: null });
    expect(Number(r.amount)).toBe(total);
  } finally {
    const { id } = await added.json();
    if (id) await page.request.delete(`/api/admin/settings/holidays/${id}`);
  }

  const used = await withDb(async (c) => (await c.query("SELECT booking_code FROM bookings WHERE status = 'used' LIMIT 1"))[0]);
  if (used) {
    const res = await page.request.post(`/api/admin/bookings/${used.booking_code}/cancel`, { data: { mode: "full", reason: "ທົດສອບ" } });
    expect(res.status()).toBe(409);
  }

  const vctx = await browser.newContext();
  const viewer = await vctx.newPage();
  await loginAs(viewer, "viewer");
  await expect(viewer).toHaveURL(/\/admin$/);
  expect((await viewer.request.post(`/api/admin/bookings/${code}/cancel`, { data: { mode: "full", reason: "ທົດສອບ" } })).status()).toBe(403);
  await vctx.close();
});

test("ນະໂຍບາຍແກ້ຈາກໜ້າ settings: ຢືນຢັນເກົ່າ → ໃໝ່ · audit (ຂໍ້ຕົກລົງ 53)", async ({ page }) => {
  await setPolicy([
    [24, 100],
    [12, 50],
  ]);
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings?tab=refund");
  const form = page.getByTestId("refund-policy");
  await form.getByLabel("ຄືນ (%)").nth(1).fill("40");
  await form.getByRole("button", { name: "ບັນທຶກ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("24h→100% · 12h→50%");
  await expect(dialog).toContainText("24h→100% · 12h→40%");
  await expect(dialog).toContainText("ການຄືນເງິນທີ່ຂໍແລ້ວຖືຈຳນວນເດີມ");
  await expectLaoTextNotClipped(page);
  await dialog.getByRole("button", { name: "ຢືນຢັນ ບັນທຶກ" }).click();
  await expect(form.getByRole("status")).toHaveText("ບັນທຶກແລ້ວ");
  const rows = await withDb((c) => c.query("SELECT hours_before h, refund_percent p FROM refund_policies ORDER BY hours_before DESC"));
  expect(rows.map((r: { h: number; p: number }) => [r.h, r.p])).toEqual([
    [24, 100],
    [12, 40],
  ]);
  await expectNoHorizontalScroll(page);
});

test("ຍົກເລີກການຈອງທີ່ຍັງບໍ່ຈ່າຍ (pending) → ບໍ່ມີແຖວຄືນເງິນ · ລູກຄ້າຍົກເລີກການຂາຍ POS ບໍ່ໄດ້", async ({ page }) => {
  const catalog = await (await page.request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const from = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 25 * 864e5).toISOString().slice(0, 10);
  const open = (await (await page.request.get(`/api/public/availability?from=${from}&to=${to}`)).json()).days.find((d: { closed: boolean; left: number }) => !d.closed && d.left > 2);
  const res = await page.request.post("/api/public/bookings", {
    data: { visitDate: open.date, items: [{ ticketTypeId: adult.id, quantity: 1 }], customer: { fullName: "ທົດສອບ ຍົກເລີກ", phone: E2E_PHONE }, expectedTotal: Number(adult.price) },
  });
  const code = (await res.json()).bookingCode as string;
  await page.goto(`/lo/booking/${code}`);
  await page.getByRole("button", { name: "ຍົກເລີກການຈອງ" }).click();
  await expect(page.getByText("ທ່ານຍັງບໍ່ໄດ້ຈ່າຍເງິນ")).toBeVisible();
  await expect(page.getByLabel("ເລກບັນຊີ")).toHaveCount(0);
  await page.getByRole("checkbox", { name: /ຂ້ອຍເຂົ້າໃຈ/ }).check();
  await page.getByRole("button", { name: "ຍົກເລີກການຈອງ", exact: true }).last().click();
  await expect(page.getByTestId("refund-status")).toContainText("ບໍ່ມີເງິນຄືນ");
  expect(await refundRow(code)).toBeUndefined();
  const [b] = await withDb((c) => c.query("SELECT status, cancelled_by, cancelled_at FROM bookings WHERE booking_code = ?", [code]));
  expect(b).toMatchObject({ status: "cancelled", cancelled_by: null });
  expect(b.cancelled_at).not.toBeNull();
});
