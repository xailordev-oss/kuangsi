import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OfflinePage } from "@/components/site/sw-register";
import { ScannerApp } from "@/components/staff/scanner-app";
import { StaffHeader } from "@/components/staff/staff-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { can, homePathForRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";
import { getGates } from "@/lib/settings";

export default function ScanPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <ScanView />
    </Suspense>
  );
}

async function ScanView() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect(`${STAFF_LOGIN_PATH}?callbackUrl=/staff/scan`);
  if (!can(user.role, "checkin.scan")) redirect(homePathForRole(user.role));

  const locale = await getStaffLocale();
  const dict = getStaffDictionary(locale);
  const gates = await getGates();
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <StaffHeader title={dict.scan.title} staffName={user.fullName} locale={locale} dict={dict} />
      <ScannerApp gates={gates} dict={dict} />
      {/* ຂໍ້ຕົກລົງ 34: ໜ້າສະແກນເປີດໄດ້ຕອນເນັດຂາດ */}
      <OfflinePage />
    </div>
  );
}
