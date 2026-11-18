import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/admin-frame";
import { UsersManager, type UserCard } from "@/components/admin/users-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { staffPage } from "@/lib/admin/page";
import { listUsers } from "@/lib/admin/users";
import { formatDateTime, t } from "@/lib/i18n/format";

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <UsersView />
    </Suspense>
  );
}

async function UsersView() {
  const { user, locale, dict } = await staffPage("users.manage", "/admin/users");
  const u = dict.admin.users;
  const users = await listUsers();
  const activeAdmins = users.filter((x) => x.role === "admin" && x.isActive).length;
  // ວັນເວລາ format ຢູ່ server (Intl ຂອງ browser ບໍ່ມີລາວ)
  const cards: UserCard[] = users.map((x) => ({
    ...x,
    isSelf: x.id === String(user.id),
    // ຂໍ້ຕົກລົງ 45: admin ທີ່ເປີດຢູ່ຄົນສຸດທ້າຍ — ປິດປຸ່ມ (server ກວດຊ້ຳ)
    isLastAdmin: x.role === "admin" && x.isActive && activeAdmins <= 1,
    lastLoginLabel: x.lastLoginAt ? t(u.lastLogin, { time: formatDateTime(x.lastLoginAt, locale) }) : u.neverLoggedIn,
    lockedLabel: x.lockedUntil ? t(u.locked, { time: formatDateTime(x.lockedUntil, locale) }) : null,
  }));
  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/users" title={u.title}>
      <UsersManager users={cards} d={u} />
    </AdminFrame>
  );
}
