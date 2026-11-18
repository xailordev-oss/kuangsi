import assert from "node:assert/strict";
import { test } from "node:test";
import { generateTempPassword } from "@/lib/admin/password";
import { newPasswordSchema } from "@/lib/auth/schemas";

test("ລະຫັດຊົ່ວຄາວ: ຮູບແບບ xxxx-xxxx-xxxx · ຜ່ານກົດລະຫັດຜ່ານ · ບໍ່ມີຕົວສັບສົນ · ບໍ່ຊ້ຳ", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const p = generateTempPassword();
    assert.match(p, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    assert.ok(!/[01OIl]/.test(p), p);
    assert.ok(newPasswordSchema.safeParse(p).success);
    seen.add(p);
  }
  assert.equal(seen.size, 500);
});
