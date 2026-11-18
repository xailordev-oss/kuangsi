import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { expectLaoTextNotClipped, expectNoHorizontalScroll } from "./checks";
import { E2E_PHONE, E2E_USERS, withDb } from "./db";
import { loginAs, paidBookingForToday } from "./helpers";

// Phase 10a (ອ່ານຢ່າງດຽວ): dashboard · ການຈອງ · ລາຍງານ · ປີ້ຊ້ຳ offline — admin ເຫັນເຕັມ · viewer ເບີປິດບາງສ່ວນ
// ຂໍ້ມູນທົດສອບ: ການຈອງມື້ນີ້ (ເບີ E2E) + ການຈ່າຍເງິນສົດ + ສະແກນຜ່ານ + ປີ້ຊ້ຳຈາກ offline sync — teardown ລຶບຕາມເບີ E2E
let code = "";

test.beforeAll(async ({ request }) => {
  ({ code } = await paidBookingForToday(request, 2));
  await withDb(async (conn) => {
    const [b] = await conn.query("SELECT id, total_amount FROM bookings WHERE booking_code = ?", [code]);
    const [scanner] = await conn.query("SELECT id FROM users WHERE username = ?", [E2E_USERS.scanner]);
    await conn.query("INSERT INTO payments (booking_id, method, amount, status, paid_at) VALUES (?, 'cash', ?, 'success', UTC_TIMESTAMP())", [b.id, b.total_amount]);
    await conn.query("INSERT INTO check_ins (booking_id, gate, scanned_by, result, scanned_at) VALUES (?, 'main', ?, 'ok', UTC_TIMESTAMP() - INTERVAL 5 MINUTE)", [b.id, scanner.id]);
    await conn.query("INSERT INTO check_ins (booking_id, gate, scanned_by, result, note) VALUES (?, 'main', ?, 'duplicate', ?)", [b.id, scanner.id, `offline_sync:${randomUUID()}`]);
    await conn.query("UPDATE bookings SET status = 'used' WHERE id = ?", [b.id]);
  });
});

test("admin dashboard: ຮັບເງິນ · ຄືນເງິນ · ສຸດທິ ແຍກກັນ ພ້ອມພື້ນຖານການນັບ (ຂໍ້ຕົກລົງ 44) · ປີ້ຊ້ຳ offline ເປັນສີເຕືອນ + ລິ້ງ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  const tile = (label: string) => page.locator("div").filter({ has: page.getByText(label, { exact: true }) }).last();
  await expect(tile("ຮັບເງິນມື້ນີ້").getByText("ນັບຕາມວັນທີຮັບເງິນ (ບໍ່ແມ່ນວັນເຂົ້າຊົມ)")).toBeVisible();
  await expect(tile("ຮັບເງິນມື້ນີ້").getByText(/^[\d,]+ ກີບ$/)).not.toHaveText("0 ກີບ");
  await expect(tile("ຄືນເງິນມື້ນີ້").getByText("ນັບຕາມວັນທີຄືນເງິນ")).toBeVisible();
  await expect(tile("ສຸດທິມື້ນີ້").getByText("ຮັບ − ຄືນ")).toBeVisible();
  const dup = page.getByRole("link").filter({ hasText: "ປີ້ຊ້ຳຈາກ offline ມື້ນີ້" });
  await expect(dup).toHaveAttribute("href", "/admin/scan-reviews");
  const byMethod = page.getByRole("table", { name: "ເງິນເຂົ້າ-ອອກມື້ນີ້ ຕາມວິທີຈ່າຍ" });
  await expect(byMethod.getByRole("rowheader", { name: "ເງິນສົດ" })).toBeVisible();
  await expect(byMethod.getByRole("columnheader")).toHaveText(["ຮັບເງິນ (ກີບ)", "ຄືນເງິນ (ກີບ)", "ສຸດທິ (ກີບ)"]);
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
});

test("admin ຄົ້ນຫາການຈອງ → ລາຍລະອຽດ: ເບີເຕັມ · ການຈ່າຍ · ປະຫວັດສະແກນ (ລວມ offline)", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/bookings");
  await page.getByPlaceholder("ຄົ້ນຫາ: ລະຫັດຈອງ / ເບີໂທ / ຊື່").fill(code.toLowerCase());
  await page.getByRole("button", { name: "ກັ່ນຕອງ" }).click();
  await expect(page.getByText("1 ລາຍການ")).toBeVisible();
  await expect(page.getByText(E2E_PHONE)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  await page.getByRole("link", { name: new RegExp(code) }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/bookings/${code}$`));
  await expect(page.getByRole("heading", { name: code })).toBeVisible();
  await expect(page.getByText("ເງິນສົດ ·", { exact: false })).toBeVisible();
  await expect(page.getByText("ສຳເລັດ", { exact: true })).toBeVisible();
  await expect(page.getByText("ຜ່ານ", { exact: true })).toBeVisible();
  await expect(page.getByText("ໃຊ້ແລ້ວ", { exact: true })).toBeVisible();
  await expect(page.getByText("offline", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);
});

test("ຄົ້ນຫາດ້ວຍເບີໂທແບບລາວ (020…) ແລະ ບໍ່ພົບ → ຂໍ້ຄວາມ + ລ້າງຕົວກັ່ນຕອງ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/bookings?q=${encodeURIComponent(E2E_PHONE.replace("+856", "0"))}`);
  await expect(page.getByRole("link", { name: new RegExp(code) })).toBeVisible();
  await page.goto("/admin/bookings?q=KS-ZZZZZ");
  await expect(page.getByText("ບໍ່ພົບການຈອງຕາມຕົວກັ່ນຕອງ")).toBeVisible();
  await expect(page.getByRole("link", { name: "ລ້າງຕົວກັ່ນຕອງ" }).first()).toHaveAttribute("href", "/admin/bookings");
  await page.goto("/admin/bookings/KS-ZZZZZ");
  await expect(page.getByText("ບໍ່ພົບການຈອງ KS-ZZZZZ")).toBeVisible();
});

test("viewer (P10-5): ເບີໂທປິດບາງສ່ວນ · ບໍ່ເຫັນອີເມວ · ເຂົ້າໜ້າ POS ບໍ່ໄດ້", async ({ page }) => {
  await loginAs(page, "viewer");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/bookings?q=${code}`);
  await expect(page.getByText("ເບີໂທຖືກປິດບາງສ່ວນ (ສິດອ່ານຢ່າງດຽວ)")).toBeVisible();
  await expect(page.getByText(E2E_PHONE)).toHaveCount(0);
  await expect(page.getByText(/\+856205•+\d\d/)).toBeVisible();
  await page.getByRole("link", { name: new RegExp(code) }).click();
  await expect(page.getByText(E2E_PHONE)).toHaveCount(0);
  await expect(page.getByText("ອີເມວ")).toHaveCount(0);
  await page.goto("/staff/pos");
  await expect(page).toHaveURL(/\/admin$/);
});

test("ລາຍງານ: ລາຍໄດ້ + ນັກທ່ອງທ່ຽວ ຕາມກຸ່ມ · ຊ່ວງເກີນ 366 ວັນ → ແຈ້ງ · CSV ບໍ່ມີຊື່ / ເບີໂທ", async ({ page }) => {
  await loginAs(page, "viewer");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/reports?preset=today");
  await expect(page.getByRole("heading", { name: "ເງິນເຂົ້າ-ອອກ", exact: true })).toBeVisible();
  await expect(page.getByText(/^ຮັບເງິນ ນັບຕາມວັນທີຮັບເງິນ · ຄືນເງິນ ນັບຕາມວັນທີຄືນເງິນ/).first()).toBeVisible();
  await expect(page.getByRole("table", { name: "ເງິນເຂົ້າ-ອອກ" }).getByRole("columnheader")).toHaveCount(3);
  await expect(page.getByRole("list", { name: "ເຂົ້າແລ້ວ (ສະແກນຜ່ານ · ຕາມວັນສະແກນ)" }).getByText("ຕ່າງປະເທດ ຜູ້ໃຫຍ່")).toBeVisible();
  await expect(page.getByRole("list", { name: "ສັນຊາດ (ສະເພາະທີ່ລູກຄ້າລະບຸ)" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectLaoTextNotClipped(page);

  const href = await page.getByRole("link", { name: "ດາວໂຫຼດ CSV" }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const csv = await res.text();
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("ເງິນສົດ");
  expect(csv).not.toContain(E2E_PHONE.slice(4));
  expect(csv).not.toContain("ທົດສອບ ສະແກນ");

  await page.goto("/admin/reports?from=2024-01-01&to=2026-01-01");
  await expect(page.getByRole("alert").filter({ hasText: "ຊ່ວງວັນທີຍາວເກີນ 366 ວັນ" })).toBeVisible();
  expect((await page.request.get("/api/admin/reports?from=2024-01-01&to=2026-01-01")).status()).toBe(400);
});

test("ປີ້ຊ້ຳ offline (ຂໍ້ຕົກລົງ 39): ສະແດງລະຫັດ + ປະຕູ/ເວລາ ທີ່ຜ່ານຄັ້ງທຳອິດ · ລິ້ງໄປລາຍລະອຽດ", async ({ page }) => {
  await loginAs(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/scan-reviews");
  const item = page.getByRole("listitem").filter({ hasText: code });
  await expect(item.getByText(/^ປ່ອຍເຂົ້າ offline: main · /)).toBeVisible();
  await expect(item.getByText(/^ຜ່ານຄັ້ງທຳອິດ: main · /)).toBeVisible();
  await expect(item.getByRole("link", { name: code })).toHaveAttribute("href", `/admin/bookings/${code}`);
  await expectLaoTextNotClipped(page);
});

test("ບໍ່ login → ໜ້າ admin / CSV ຖືກປະຕິເສດ", async ({ page }) => {
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/staff\/login/);
  expect((await page.request.get("/api/admin/reports?preset=today")).status()).toBe(401);
});
