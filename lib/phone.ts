// ແປງເບີໂທເປັນ E.164 ເພື່ອໃຫ້ກວດເບີຊ້ຳໄດ້ຖືກ (ຂໍ້ຕົກລົງ 4, 24)
//   "020 5555 5555" · "20 5555 5555" · "+856 20 5555 5555" · "+856 020 5555 5555" → "+8562055555555"
// ເບີທີ່ບໍ່ມີ + ຫຼື 00 ຖືວ່າເປັນເບີພາຍໃນຂອງ defaultCallingCode (ລາວ = 856) ແລະ ຖິ້ມເລກ 0 ນຳໜ້າ (trunk prefix)
export const LAO_CALLING_CODE = "856";

export function normalizePhone(input: string, defaultCallingCode = LAO_CALLING_CODE): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, "");
  if (!compact) return null;

  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else digits = defaultCallingCode + compact.replace(/^0/, "");

  if (!/^\d+$/.test(digits)) return null;

  // ຜູ້ໃຊ້ພິມ +856 ແລ້ວຕາມດ້ວຍ 020… — ເລກ 0 ຫຼັງລະຫັດປະເທດຕ້ອງຖິ້ມ
  if (digits.startsWith(`${LAO_CALLING_CODE}0`)) digits = LAO_CALLING_CODE + digits.slice(LAO_CALLING_CODE.length + 1);

  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  // ລາວ: ມືຖື 20/30 + 7–8 ຕົວ, ໂທລະສັບບ້ານ 2 ຕົວລະຫັດເຂດ + 6 ຕົວ → 8–10 ຕົວຫຼັງ 856
  if (digits.startsWith(LAO_CALLING_CODE) && !/^856[1-9]\d{7,9}$/.test(digits)) return null;

  return `+${digits}`;
}
