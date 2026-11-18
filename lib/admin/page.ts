import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { can, homePathForRole, STAFF_LOGIN_PATH, type Permission } from "@/lib/auth/roles";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";

// ກວດສິດແທ້ຈາກ DB ໃນທຸກໜ້າ admin (proxy ກວດແບບ optimistic ເທົ່ານັ້ນ) — ເອີ້ນພາຍໃນ <Suspense>
export async function staffPage(permission: Permission, path: string) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect(`${STAFF_LOGIN_PATH}?callbackUrl=${encodeURIComponent(path)}`);
  if (!can(user.role, permission)) redirect(homePathForRole(user.role));
  const locale = await getStaffLocale();
  return { user, locale, dict: getStaffDictionary(locale) };
}
