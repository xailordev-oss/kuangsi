import assert from "node:assert/strict";
import { test } from "node:test";
import { maskPhone } from "@/lib/admin/mask";

test("ປິດເບີໂທບາງສ່ວນ ສຳລັບ viewer (P10-5)", () => {
  assert.equal(maskPhone("+8562055551234"), "+856205•••••34");
  assert.equal(maskPhone("+66812345678"), "+668123•••78");
  assert.equal(maskPhone("+12345"), "••••••");
  assert.equal(maskPhone(null), null);
});

test("ບໍ່ເຫຼືອຕົວເລກກາງ (ພໍທີ່ຈະຕິດຕໍ່ບໍ່ໄດ້)", () => {
  const m = maskPhone("+8562099998888")!;
  assert.equal(m.length, "+8562099998888".length);
  assert.ok(!m.includes("9999"));
});
