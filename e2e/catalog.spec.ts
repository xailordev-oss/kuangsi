import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_PHONE, withDb } from "./db";
import { loginAs } from "./helpers";

// Phase 10c: ປີ້ ແລະ ລາຄາ — ຢືນຢັນລາຄາເກົ່າ-ໃໝ່ · ການຈອງທີ່ຖືລາຄາເກົ່າ (ຂໍ້ຕົກລົງ 51) · ລັອກ code/ກຸ່ມ/ກຸ່ມອາຍຸ (ຂໍ້ຕົກລົງ 52)
const NEW_CODE = "E2E_TEST_TYPE";
let snapshot: { code: string; price: string; is_active: number }[] = [];

test.beforeAll(async () => {
  snapshot = await withDb((c) => c.query("SELECT code, price, is_active FROM ticket_types"));
});

test.afterAll(async () => {
  await withDb(async (c) => {
    for (const r of snapshot) await c.query("UPDATE ticket_types SET price = ?, is_active = ? WHERE code = ?", [r.price, r.is_active, r.code]);
    // ແຖວທົດສອບບໍ່ມີການຈອງອ້າງອີງ — ລຶບໄດ້ (ແອັບເອງບໍ່ມີທາງລຶບ)
    await c.query("DELETE FROM ticket_types WHERE code = ?", [NEW_CODE]);
  });
});

const audit = (action: string, code: string) =>
  withDb(async (c) => {
    const [row] = await c.query(
      "SELECT a.old_value o, a.new_value n FROM audit_logs a JOIN ticket_types t ON t.id = a.record_id WHERE a.action = ? AND a.table_name = 'ticket_types' AND t.code = ? ORDER BY a.id DESC LIMIT 1",
      [action, code],
    );
    const j = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
    return { o: j(row.o), n: j(row.n) };
  });

test("ປ່ຽນລາຄາ → Dialog ສະແດງເກົ່າ/ໃໝ່ + ສ່ວນຕ່າງ + ການຈອງທີ່ຍັງຖືລາຄາເກົ່າ → ຢືນຢັນ → audit ticket_type.price", async ({ page }) => {
  const catalog = await (await page.request.get("/api/public/catalog")).json();
  const child = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_CHILD");
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const oldPrice = Number(child.price);
  const from = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const open = (await (await page.request.get(`/api/public/availability?from=${from}&to=${to}`)).json()).days.find((x: { closed: boolean; left: number }) => !x.closed && x.left > 4);
  const res = await page.request.post("/api/public/bookings", {
    data: {
      visitDate: open.date,
      items: [
        { ticketTypeId: adult.id, quantity: 1 },
        { ticketTypeId: child.id, quantity: 1 },
      ],
      customer: { fullName: "ທົດສອບ ລາຄາປີ້", phone: E2E_PHONE },
      expectedTotal: Number(adult.price) + oldPrice,
    },
  });
  expect(res.status()).toBe(201);

  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("navigation").getByRole("link", { name: "ປີ້ ແລະ ລາຄາ", exact: true }).click();
  await page.getByRole("combobox", { name: "ເລືອກໝວດ" }).selectOption("foreigner");
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  await page.getByTestId("tt-FOR_CHILD").getByRole("button", { name: "ແກ້" }).click();
  const form = page.getByRole("dialog");
  await expect(form).toContainText("FOR_CHILD · ຕ່າງປະເທດ · ເດັກ — ລັອກຫຼັງສ້າງ");
  await form.getByLabel("ລາຄາ (ກີບ)").fill(String(oldPrice + 5000));
  await form.getByRole("button", { name: "ບັນທຶກ" }).click();

  const impact = page.getByTestId("catalog-impact");
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  await expect(impact).toContainText(`ເກົ່າ: ${fmt(oldPrice)} ກີບ`);
  await expect(impact).toContainText(`ໃໝ່: ${fmt(oldPrice + 5000)} ກີບ (+5,000 · +${Math.round((5000 / oldPrice) * 100)}%)`);
  await expect(impact).toContainText(/ລໍຈ່າຍ [1-9]\d* · ລໍກວດ \d+ — ຍັງຈ່າຍລາຄາເກົ່າ/);
  await expectLaoTextNotClipped(page);
  await page.getByRole("button", { name: "ຢືນຢັນ ບັນທຶກ" }).click();
  await expect(page.getByTestId("tt-FOR_CHILD")).toContainText(`${fmt(oldPrice + 5000)} ກີບ`);

  const a = await audit("ticket_type.price", "FOR_CHILD");
  expect(a.o).toEqual({ price: oldPrice });
  expect(a.n.price).toBe(oldPrice + 5000);
  expect(a.n._impact.holding.pending).toBeGreaterThanOrEqual(1);
});

test("server ກວດ: ລັອກກຸ່ມ (400) · ປີ້ຟຣີຕ້ອງ 0 (422) · ບໍ່ຢືນຢັນ = ບໍ່ບັນທຶກ · ປີ້ເສຍເງິນອັນສຸດທ້າຍ → ເຕືອນ · code ຊ້ຳ · viewer 403", async ({ page, browser }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  const ids = Object.fromEntries(
    (await withDb((c) => c.query("SELECT code, id FROM ticket_types"))).map((r: { code: string; id: bigint }) => [r.code, String(r.id)]),
  );
  const base = { nameLo: "ທົດສອບ", nameEn: "Test", ageMin: null, ageMax: null, sortOrder: 9, isActive: true };

  // ຂໍ້ຕົກລົງ 52: ກຸ່ມ / code ສົ່ງມາກັບການແກ້ = ປະຕິເສດ
  const locked = await page.request.patch(`/api/admin/ticket-types/${ids.LAO_ADULT}`, { data: { ...base, price: 25000, visitorGroup: "foreigner" } });
  expect(locked.status()).toBe(400);
  const free = await page.request.patch(`/api/admin/ticket-types/${ids.LAO_FREE}`, { data: { ...base, price: 1000 } });
  expect(free.status()).toBe(422);
  expect((await free.json()).error).toBe("free_price_mismatch");

  const unconfirmed = await page.request.patch(`/api/admin/ticket-types/${ids.LAO_ADULT}`, { data: { ...base, nameLo: "ຄົນລາວ — ຜູ້ໃຫຍ່", nameEn: "Lao adult", sortOrder: 1, price: 99000 } });
  expect(unconfirmed.status()).toBe(409);
  const [{ price }] = await withDb((c) => c.query("SELECT price FROM ticket_types WHERE code = 'LAO_ADULT'"));
  expect(Number(price)).toBe(Number(snapshot.find((r) => r.code === "LAO_ADULT")!.price));

  // ປິດ FOR_CHILD ແລ້ວ → FOR_ADULT ເປັນປີ້ເສຍເງິນອັນສຸດທ້າຍຂອງຕ່າງປະເທດ
  const child = await withDb(async (c) => (await c.query("SELECT * FROM ticket_types WHERE code = 'FOR_CHILD'"))[0]);
  const adultRow = await withDb(async (c) => (await c.query("SELECT * FROM ticket_types WHERE code = 'FOR_ADULT'"))[0]);
  const editable = (r: Record<string, unknown>, isActive: boolean) => ({
    nameLo: r.name_lo,
    nameEn: r.name_en,
    nameZh: r.name_zh ?? "",
    nameTh: r.name_th ?? "",
    price: Number(r.price),
    ageMin: r.age_min,
    ageMax: r.age_max,
    sortOrder: r.sort_order,
    isActive,
  });
  expect((await page.request.patch(`/api/admin/ticket-types/${ids.FOR_CHILD}`, { data: { ...editable(child, false), confirm: true } })).status()).toBe(200);
  const last = await page.request.patch(`/api/admin/ticket-types/${ids.FOR_ADULT}`, { data: editable(adultRow, false) });
  expect(last.status()).toBe(409);
  expect((await last.json()).impact).toMatchObject({ kind: "catalog", deactivating: true, lastPaidInGroup: "foreigner" });
  expect((await page.request.patch(`/api/admin/ticket-types/${ids.FOR_CHILD}`, { data: { ...editable(child, true), confirm: true } })).status()).toBe(200);

  // ເພີ່ມປະເພດໃໝ່: ຢືນຢັນກ່ອນ · code ຊ້ຳ
  const create = { code: NEW_CODE, visitorGroup: "lao", ageGroup: "senior", ...base, price: 15000, isActive: false };
  expect((await page.request.post("/api/admin/ticket-types", { data: create })).status()).toBe(409);
  expect((await page.request.post("/api/admin/ticket-types", { data: { ...create, confirm: true } })).status()).toBe(201);
  const dup = await page.request.post("/api/admin/ticket-types", { data: { ...create, confirm: true } });
  expect((await dup.json()).error).toBe("code_taken");

  const ctx = await browser.newContext();
  const viewer = await ctx.newPage();
  await loginAs(viewer, "viewer");
  await expect(viewer).toHaveURL(/\/admin$/);
  expect((await viewer.request.patch(`/api/admin/ticket-types/${ids.LAO_ADULT}`, { data: base })).status()).toBe(403);
  await viewer.goto("/admin/ticket-types");
  await expect(viewer).toHaveURL(/\/admin$/);
  await ctx.close();
});

test("ທຸກ tab ເປີດໄດ້ທີ່ 375px · ບໍລິການເສີມ ລັອກໜ່ວຍ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  for (const tab of ["lao", "foreigner", "addons"]) {
    await page.goto(`/admin/ticket-types?tab=${tab}`);
    await expect(page.locator("#tab-title")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectLaoTextNotClipped(page);
  }
  await page.getByTestId("addon-GUIDE").getByRole("button", { name: "ແກ້" }).click();
  await expect(page.getByRole("dialog")).toContainText("GUIDE · ຕໍ່ການຈອງ — ລັອກຫຼັງສ້າງ");
  const [{ id }] = await withDb((c) => c.query("SELECT id FROM add_ons WHERE code = 'GUIDE'"));
  const r = await page.request.patch(`/api/admin/add-ons/${id}`, { data: { nameLo: "x", nameEn: "x", price: 1, isActive: true, unit: "per_person" } });
  expect(r.status()).toBe(400);
});
