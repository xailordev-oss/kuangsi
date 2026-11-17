import { cookies } from "next/headers";
import en from "@/dictionaries/staff/en.json";
import lo from "@/dictionaries/staff/lo.json";

// ຂໍ້ຕົກລົງ 33: ໜ້າພະນັກງານ ລາວ (ຄ່າເລີ່ມຕົ້ນ) + ອັງກິດ · ເລືອກໃນຫົວຈໍ ເກັບໃນ cookie
export const STAFF_LOCALES = ["lo", "en"] as const;
export type StaffLocale = (typeof STAFF_LOCALES)[number];
export type StaffDictionary = typeof en;
export const STAFF_LANG_COOKIE = "staff_lang";

export async function getStaffLocale(): Promise<StaffLocale> {
  return (await cookies()).get(STAFF_LANG_COOKIE)?.value === "en" ? "en" : "lo";
}

export function getStaffDictionary(locale: StaffLocale): StaffDictionary {
  return locale === "en" ? en : lo;
}
