import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ບໍ່ມີ 0/O ແລະ 1/I ເພື່ອໃຫ້ອ່ານລະຫັດດ້ວຍຕາໄດ້ (ສຳຮອງຕອນສະແກນບໍ່ໄດ້) · 32 ຕົວ → ບໍ່ bias
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateBookingCode(): string {
  const bytes = randomBytes(5);
  return `KS-${Array.from(bytes, (b) => ALPHABET[b & 31]).join("")}`;
}

export function generateQrToken(): string {
  return crypto.randomUUID();
}

// cookie ສິດເບິ່ງໜ້າການຈອງ (ຂໍ້ຕົກລົງ 19) — ລົງລາຍເຊັນດ້ວຍ AUTH_SECRET
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function bookingAccessCookieName(code: string): string {
  return `ksb_${code}`;
}

export function signBookingAccess(code: string): string {
  return createHmac("sha256", secret()).update(`booking-access:${code}`).digest("base64url");
}

export function verifyBookingAccess(code: string, value: string | undefined): boolean {
  if (!value) return false;
  const expected = Buffer.from(signBookingAccess(code));
  const given = Buffer.from(value);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
