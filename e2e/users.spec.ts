import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_USERS, withDb } from "./db";
import { loginAs } from "./helpers";

// Phase 10b-1: ຈັດການຜູ້ໃຊ້ · ຂໍ້ຕົກລົງ 45 (admin ຄົນສຸດທ້າຍ) · ຂໍ້ຕົກລົງ 46 (ລະຫັດສຸ່ມ ສະແດງເທື່ອດຽວ)
// ລະຫວ່າງ test: e2e_admin ເປັນ admin ທີ່ເປີດຢູ່ຄົນດຽວ — afterAll ເປີດ admin ອື່ນຄືນ (ບໍ່ລຶບ user ໃດ)
let others: number[] = [];

test.beforeAll(async () => {
  others = await withDb(async (conn) => {
    const rows: { id: number }[] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND username <> ?", [E2E_USERS.admin]);
    if (rows.length) await conn.query("UPDATE users SET is_active = 0 WHERE id IN (?)", [rows.map((r) => r.id)]);
    return rows.map((r) => r.id);
  });
});

test.afterAll(async () => {
  await withDb(async (conn) => {
    // test ສຸດທ້າຍອາດປິດ e2e_admin (ຜົນຂອງການແຂ່ງກັນ) — ເປີດຄືນໃຫ້ spec ອື່ນ
    await conn.query("UPDATE users SET is_active = 1 WHERE username = ?", [E2E_USERS.admin]);
    if (others.length) await conn.query("UPDATE users SET is_active = 1 WHERE id IN (?)", [others]);
  });
});

test("admin ຄົນສຸດທ້າຍ: ປຸ່ມປິດບັນຊີ + ປ່ຽນບົດບາດ ຖືກປິດ ພ້ອມເຫດຜົນ 'ຕ້ອງມີ admin ຢ່າງໜ້ອຍ 1 ຄົນ'", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("navigation").getByRole("link", { name: "ຜູ້ໃຊ້", exact: true }).click();
  const me = page.getByTestId(`user-${E2E_USERS.admin}`);
  await expect(me.getByRole("button", { name: "ປິດບັນຊີ" })).toBeDisabled();
  await expect(me.getByRole("combobox")).toBeDisabled();
  await expect(me.getByText("ຕ້ອງມີ admin ຢ່າງໜ້ອຍ 1 ຄົນ")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  // server ກວດຊ້ຳ — ເຖິງຈະຂ້າມ UI ໄປເອີ້ນ API ໂດຍກົງ
  const id = await withDb(async (conn) => (await conn.query("SELECT id FROM users WHERE username = ?", [E2E_USERS.admin]))[0].id);
  const res = await page.request.patch(`/api/admin/users/${id}`, { data: { action: "deactivate" } });
  expect(res.status()).toBe(409);
  expect(await res.json()).toEqual({ error: "last_admin" });
});

test("ເພີ່ມຜູ້ໃຊ້ → ລະຫັດຊົ່ວຄາວສະແດງເທື່ອດຽວ → login ໄດ້ → ປິດບັນຊີ (ມີ Dialog ຢືນຢັນ)", async ({ page, browser }) => {
  const username = `e2e_u${Date.now().toString(36)}`;
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "ເພີ່ມຜູ້ໃຊ້" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("ຊື່ຜູ້ໃຊ້ (ສຳລັບ login)").fill(username);
  await form.getByLabel("ຊື່ ແລະ ນາມສະກຸນ").fill("ພະນັກງານ ສະແກນ ໃໝ່");
  await form.getByLabel("ອີເມວ").fill(`${username}@example.invalid`);
  await form.getByLabel("ບົດບາດ", { exact: true }).selectOption("scanner");
  await form.getByRole("button", { name: "ສ້າງ" }).click();

  const shown = page.getByTestId("temp-password");
  await expect(shown).toHaveText(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  const password = (await shown.textContent())!;
  await expect(page.getByText(/ສະແດງເທື່ອດຽວ/)).toBeVisible();
  await expectLaoTextNotClipped(page);
  await page.getByRole("button", { name: "ປິດ", exact: true }).click();
  await expect(page.getByTestId("temp-password")).toHaveCount(0);

  const card = page.getByTestId(`user-${username}`);
  await expect(card.getByText("ສະແກນ", { exact: true })).toBeVisible();

  const other = await browser.newContext();
  const staff = await other.newPage();
  await staff.goto("/staff/login");
  await staff.getByLabel("ຊື່ຜູ້ໃຊ້").fill(username);
  await staff.getByLabel("ລະຫັດຜ່ານ").fill(password);
  await staff.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();
  await expect(staff).toHaveURL(/\/staff\/scan$/);
  expect((await staff.request.get("/api/staff/scan/manifest")).status()).toBe(200);

  await card.getByRole("button", { name: "ປິດບັນຊີ" }).click();
  await expect(page.getByRole("dialog")).toContainText("ປິດບັນຊີ ພະນັກງານ ສະແກນ ໃໝ່?");
  await page.getByRole("button", { name: "ຢືນຢັນ" }).click();
  await expect(card.getByText("ປິດແລ້ວ", { exact: true })).toBeVisible();

  // session ຂອງຄົນທີ່ຖືກປິດ ໃຊ້ບໍ່ໄດ້ທັນທີ (ໜ້າສະແກນເອງ cache ໄວ້ໃຊ້ offline — ຂໍ້ຕົກລົງ 34 — ສະນັ້ນກວດທີ່ API)
  expect((await staff.request.get("/api/staff/scan/manifest")).status()).toBe(401);
  await other.close();
});

test("2 admin ປິດບັນຊີກັນແລະກັນພ້ອມກັນ → ສຳເລັດອັນດຽວ · ຍັງເຫຼືອ admin ທີ່ເປີດຢູ່ 1 ຄົນ", async ({ page, browser }) => {
  const username = `e2e_a${Date.now().toString(36)}`;
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  const created = await page.request.post("/api/admin/users", {
    data: { username, fullName: "admin ທົດສອບ ແຂ່ງກັນ", email: `${username}@example.invalid`, role: "admin" },
  });
  expect(created.status()).toBe(201);
  const { id: otherId, password } = await created.json();
  const selfId = String(await withDb(async (conn) => (await conn.query("SELECT id FROM users WHERE username = ?", [E2E_USERS.admin]))[0].id));

  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto("/staff/login");
  await second.getByLabel("ຊື່ຜູ້ໃຊ້").fill(username);
  await second.getByLabel("ລະຫັດຜ່ານ").fill(password);
  await second.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();
  await expect(second).toHaveURL(/\/admin$/);

  const [a, b] = await Promise.all([
    page.request.patch(`/api/admin/users/${otherId}`, { data: { action: "deactivate" } }),
    second.request.patch(`/api/admin/users/${selfId}`, { data: { action: "deactivate" } }),
  ]);
  const statuses = [a.status(), b.status()].sort();
  // ອັນທີ 2 ທີ່ເຂົ້າຄິວ ພົບວ່າຕົນເອງຖືກປິດແລ້ວ (403) — ບໍ່ມີທາງທີ່ທັງ 2 ສຳເລັດ
  expect(statuses[0]).toBe(200);
  expect([401, 403, 409]).toContain(statuses[1]);
  const remaining = await withDb(async (conn) => (await conn.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1"))[0].n);
  expect(Number(remaining)).toBe(1);
  await other.close();
});
