import { cookies } from "next/headers";
import { bookingAccessCookieName, signBookingAccess, verifyBookingAccess } from "@/lib/booking/codes";

const ACCESS_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

// ຂໍ້ຕົກລົງ 19: ເບິ່ງໜ້າການຈອງໄດ້ສະເພາະ browser ທີ່ຫາກໍຈອງ ຫຼື ຢືນຢັນລະຫັດຈອງ + ເບີໂທແລ້ວ
export async function grantBookingAccess(code: string): Promise<void> {
  (await cookies()).set(bookingAccessCookieName(code), signBookingAccess(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
}

export async function hasBookingAccess(code: string): Promise<boolean> {
  return verifyBookingAccess(code, (await cookies()).get(bookingAccessCookieName(code))?.value);
}
