import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StaffHeader } from "@/components/staff/staff-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";

// TODO(Phase 10): dashboard ແທ້ — ດຽວນີ້ admin ໄປໜ້າກວດຫຼັກຖານ · viewer ເຫັນໜ້າແຈ້ງ (ຂໍ້ຕົກລົງ 40)
export default function AdminHomePage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-64" />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect(`${STAFF_LOGIN_PATH}?callbackUrl=/admin`);
  if (user.role === "admin") redirect("/staff/proofs?notice=admin-not-ready");

  const locale = await getStaffLocale();
  const dict = getStaffDictionary(locale);
  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <StaffHeader title={dict.common.siteName} staffName={user.fullName} locale={locale} dict={dict} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-3 px-4 py-16 text-center">
        <BarChart3 aria-hidden className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">{dict.notReady.title}</h1>
        <p className="text-muted-foreground">{dict.notReady.body}</p>
      </main>
    </div>
  );
}
