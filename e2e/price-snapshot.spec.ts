import { expect, test } from "@playwright/test";
import { E2E_PHONE, withDb } from "./db";

// ຄຳຖາມຂອງ 10c: ການແກ້ລາຄາ ກະທົບການຈອງທີ່ມີຢູ່ແລ້ວ (ລວມ pending ທີ່ລໍຈ່າຍ) ບໍ່?
// ຄຳຕອບ: ບໍ່ — booking_items.unit_price + bookings.total_amount ເປັນ snapshot ຕອນຈອງ · ຍອດທີ່ຕ້ອງໂອນ ແລະ payments.amount ໃຊ້ total_amount
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const BUMP = 7000;

let original: string | null = null;

test.afterAll(async () => {
  if (original !== null) await withDb((c) => c.query("UPDATE ticket_types SET price = ? WHERE code = 'FOR_ADULT'", [original]));
});

test("ແກ້ລາຄາ → ການຈອງ pending ເດີມຖືລາຄາເກົ່າຈົນຈ່າຍ · ການຈອງໃໝ່ໄດ້ລາຄາໃໝ່", async ({ page }) => {
  original = String((await withDb((c) => c.query("SELECT price FROM ticket_types WHERE code = 'FOR_ADULT'")))[0].price);
  const oldPrice = Number(original);

  const catalog = await (await page.request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const from = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const days = (await (await page.request.get(`/api/public/availability?from=${from}&to=${to}`)).json()).days;
  const open = days.find((d: { closed: boolean; left: number }) => !d.closed && d.left > 4);
  const book = async (unitPrice: number) => {
    const res = await page.request.post("/api/public/bookings", {
      data: { visitDate: open.date, items: [{ ticketTypeId: adult.id, quantity: 2 }], customer: { fullName: "ທົດສອບ ລາຄາ", phone: E2E_PHONE }, expectedTotal: unitPrice * 2 },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).bookingCode as string;
  };

  const oldCode = await book(oldPrice);
  await withDb((c) => c.query("UPDATE ticket_types SET price = price + ? WHERE code = 'FOR_ADULT'", [BUMP]));

  // ລູກຄ້າທີ່ກຳລັງລໍຈ່າຍ ເຫັນຍອດເດີມ (browser ນີ້ມີ cookie ສິດຈາກການຈອງ — ຂໍ້ຕົກລົງ 19)
  const pending = await (await page.request.get(`/api/public/bookings/${oldCode}`)).json();
  expect(pending.status).toBe("pending");
  expect(Number(pending.total)).toBe(oldPrice * 2);
  expect(Number(pending.items[0].unitPrice)).toBe(oldPrice);

  // ສົ່ງຫຼັກຖານຫຼັງລາຄາປ່ຽນ → ຍອດທີ່ພະນັກງານກວດ (payments.amount) ຍັງເປັນລາຄາເກົ່າ
  const upload = await page.request.post(`/api/public/bookings/${oldCode}/proof`, {
    multipart: { proof: { name: "slip.png", mimeType: "image/png", buffer: PNG } },
  });
  expect(upload.ok()).toBeTruthy();
  const [pay] = await withDb((c) =>
    c.query("SELECT p.amount FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.booking_code = ? ORDER BY p.id DESC LIMIT 1", [oldCode]),
  );
  expect(Number(pay.amount)).toBe(oldPrice * 2);

  const newCode = await book(oldPrice + BUMP);
  const fresh = await (await page.request.get(`/api/public/bookings/${newCode}`)).json();
  expect(Number(fresh.total)).toBe((oldPrice + BUMP) * 2);
});

// ຂໍ້ຕົກລົງ 50: ລາຄາປ່ຽນ "ກ່ອນ" ກົດຢືນຢັນ → ບໍ່ສ້າງການຈອງ · ບອກຍອດເກົ່າ ແລະ ຍອດໃໝ່ ໃຫ້ຊັດ
test("ລາຄາປ່ຽນລະຫວ່າງໜ້າທົບທວນ → 409 price_changed (ບໍ່ສ້າງການຈອງ) · ຈໍບອກຍອດເກົ່າ → ໃໝ່ · ຢືນຢັນອີກຄັ້ງໄດ້ລາຄາໃໝ່", async ({ page }) => {
  original ??= String((await withDb((c) => c.query("SELECT price FROM ticket_types WHERE code = 'FOR_ADULT'")))[0].price);
  const oldPrice = Number(original);
  const catalog = await (await page.request.get("/api/public/catalog")).json();
  const adult = catalog.ticketTypes.find((t: { code: string }) => t.code === "FOR_ADULT");
  const from = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const days = (await (await page.request.get(`/api/public/availability?from=${from}&to=${to}`)).json()).days;
  const open = days.find((d: { closed: boolean; left: number }) => !d.closed && d.left > 4);
  const count = async () => Number((await withDb((c) => c.query("SELECT COUNT(*) n FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE c.phone = ?", [E2E_PHONE])))[0].n);

  // API: ຍອດທີ່ລູກຄ້າເຫັນ (ລາຄາເກົ່າ) ≠ ລາຄາປັດຈຸບັນ
  await withDb((c) => c.query("UPDATE ticket_types SET price = ? WHERE code = 'FOR_ADULT'", [oldPrice + BUMP]));
  const before = await count();
  const stale = await page.request.post("/api/public/bookings", {
    data: { visitDate: open.date, items: [{ ticketTypeId: adult.id, quantity: 2 }], customer: { fullName: "ທົດສອບ ລາຄາ", phone: E2E_PHONE }, expectedTotal: oldPrice * 2 },
  });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({ error: "price_changed", expectedTotal: String(oldPrice * 2), total: String((oldPrice + BUMP) * 2) });
  expect(await count()).toBe(before);

  // UI: ເປີດໜ້າທົບທວນດ້ວຍລາຄາເກົ່າ → admin ແກ້ລາຄາ → ກົດຢືນຢັນ
  await withDb((c) => c.query("UPDATE ticket_types SET price = ? WHERE code = 'FOR_ADULT'", [oldPrice]));
  await page.goto("/lo");
  await page.evaluate(
    ([date, id]) =>
      sessionStorage.setItem(
        "kuangsi-booking-draft-v1",
        JSON.stringify({
          visitDate: date,
          group: "foreigner",
          tickets: { [id]: 2 },
          addOns: {},
          customer: { fullName: "ທົດສອບ ລາຄາ", phone: "+8562055558888", phoneCountry: "LA", phoneNational: "2055558888" },
        }),
      ),
    [open.date, adult.id],
  );
  await page.goto("/lo/book/review");
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  await expect(page.getByRole("button", { name: `ຢືນຢັນການຈອງ · ${fmt(oldPrice * 2)} ກີບ` })).toBeVisible();
  await withDb((c) => c.query("UPDATE ticket_types SET price = ? WHERE code = 'FOR_ADULT'", [oldPrice + BUMP]));
  await page.getByRole("button", { name: /^ຢືນຢັນການຈອງ/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ຍອດເກົ່າ" })).toContainText(`ຍອດເກົ່າ ${fmt(oldPrice * 2)} ກີບ → ຍອດໃໝ່ ${fmt((oldPrice + BUMP) * 2)} ກີບ`);
  await expect(page.getByRole("alert").filter({ hasText: "ຍອດເກົ່າ" })).toContainText("ຍັງບໍ່ໄດ້ສ້າງການຈອງ");
  expect(await count()).toBe(before);

  // ລາຍການເທິງຈໍໂຫຼດລາຄາໃໝ່ → ກົດອີກຄັ້ງ = ຈອງດ້ວຍລາຄາທີ່ເຫັນ
  const retry = page.getByRole("button", { name: `ຢືນຢັນການຈອງ · ${fmt((oldPrice + BUMP) * 2)} ກີບ` });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page).toHaveURL(/\/lo\/booking\/KS-/);
  const code = page.url().split("/").pop()!;
  const [b] = await withDb((c) => c.query("SELECT total_amount FROM bookings WHERE booking_code = ?", [code]));
  expect(Number(b.total_amount)).toBe((oldPrice + BUMP) * 2);
});
