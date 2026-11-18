// P10-5: viewer ເຫັນເບີໂທແບບປິດບາງສ່ວນ (ລະຫັດປະເທດ + ຕົວເລກທຳອິດ … 2 ຕົວສຸດທ້າຍ) · admin ເຫັນເຕັມ
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 10) return "•".repeat(phone.length);
  return `${phone.slice(0, 7)}${"•".repeat(phone.length - 9)}${phone.slice(-2)}`;
}
