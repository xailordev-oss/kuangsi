import { connection } from "next/server";
import { Suspense } from "react";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffLoginForm } from "@/components/staff/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n/format";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";
import { getIntSetting } from "@/lib/settings";

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-80" />}>
      <LoginView />
    </Suspense>
  );
}

async function LoginView() {
  await connection();
  const locale = await getStaffLocale();
  const dict = getStaffDictionary(locale);
  const [attempts, minutes] = await Promise.all([getIntSetting("login_max_attempts"), getIntSetting("login_lockout_minutes")]);
  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <StaffHeader title={dict.common.siteName} locale={locale} dict={dict} />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{dict.login.title}</h1>
        {/* useSearchParams (callbackUrl) ຕ້ອງຢູ່ໃນ Suspense */}
        <Suspense fallback={<Skeleton className="h-64" />}>
          <StaffLoginForm dict={dict} lockoutHint={t(dict.login.lockoutHint, { attempts, minutes })} />
        </Suspense>
      </main>
    </div>
  );
}
