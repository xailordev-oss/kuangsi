import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone } from "./phone";

const LAO_MOBILE = "+8562055555555";

test("ເບີລາວ 3 ຮູບແບບຫຼັກ ໄດ້ E.164 ດຽວກັນ: 020… / 20… / +85620…", () => {
  assert.equal(normalizePhone("020 5555 5555"), LAO_MOBILE);
  assert.equal(normalizePhone("20 5555 5555"), LAO_MOBILE);
  assert.equal(normalizePhone("+85620 5555 5555"), LAO_MOBILE);
});

test("ຮູບແບບອື່ນທີ່ຜູ້ໃຊ້ມັກພິມ ກໍໄດ້ຜົນດຽວກັນ", () => {
  for (const input of ["02055555555", "2055555555", "+8562055555555", "+856 20 5555 5555", "020-5555-5555", "(020) 5555 5555", "00856 20 5555 5555", " 020 5555 5555 "]) {
    assert.equal(normalizePhone(input), LAO_MOBILE, input);
  }
});

test("ເລກ 0 ຫຼັງ +856 ຖືກຖິ້ມ — ບໍ່ມີ +856020…", () => {
  assert.equal(normalizePhone("+856 020 5555 5555"), LAO_MOBILE);
  assert.equal(normalizePhone("00856 020 5555 5555"), LAO_MOBILE);
  assert.doesNotMatch(normalizePhone("020 5555 5555") ?? "", /^\+8560/);
});

test("ເບີລາວອື່ນ: ມືຖື 030 ແລະ ໂທລະສັບບ້ານ 021", () => {
  assert.equal(normalizePhone("030 5 123 456"), "+856305123456");
  assert.equal(normalizePhone("021 212 345"), "+85621212345");
});

test("ເບີຕ່າງປະເທດທີ່ມີ + ຫຼື 00 ບໍ່ຖືກປ່ຽນລະຫັດປະເທດ", () => {
  assert.equal(normalizePhone("+66 81 234 5678"), "+66812345678");
  assert.equal(normalizePhone("0066 81 234 5678"), "+66812345678");
  assert.equal(normalizePhone("+86 138 0013 8000"), "+8613800138000");
});

test("ປະຕິເສດຂໍ້ມູນທີ່ບໍ່ແມ່ນເບີໂທ", () => {
  for (const input of ["", "   ", "abc", "020 5555 55a5", "+", "123", "+856 20 55", "+0 123 4567"]) {
    assert.equal(normalizePhone(input), null, JSON.stringify(input));
  }
});
