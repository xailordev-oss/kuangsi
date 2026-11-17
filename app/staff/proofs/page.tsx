import { Construction } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProofQueue, type ProofCard } from "@/components/staff/proof-queue";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffNav } from "@/components/staff/staff-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { can, homePathForRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { formatKip, formatVisitDate, t } from "@/lib/i18n/format";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";
import { listProofQueue } from "@/lib/payments/proofs";

type SearchParams = Promise<{ notice?: string }>;

export default function ProofsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <ProofsView searchParams={searchParams} />
    </Suspense>
  );
}

async function ProofsView({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  // proxy ກວດແບບ optimistic ແລ້ວ — ນີ້ແມ່ນການກວດແທ້ຈາກ DB (ບັນຊີເປີດຢູ່ + ບົດບາດປັດຈຸບັນ)
  const user = await getCurrentUser();
  if (!user) redirect(`${STAFF_LOGIN_PATH}?callbackUrl=/staff/proofs`);
  if (!can(user.role, "proof.verify")) redirect(homePathForRole(user.role));

  const locale = await getStaffLocale();
  const dict = getStaffDictionary(locale);
  // ຂໍ້ຕົກລົງ 40: ໜ້າທີ່ຍັງບໍ່ທັນເຮັດ ພາມາທີ່ນີ້ພ້ອມຂໍ້ຄວາມ (ບໍ່ໃຫ້ຂຶ້ນ 404)
  const notices: Record<string, string> = { "admin-not-ready": dict.proofs.adminNotReady };
  const notice = notices[(await searchParams).notice ?? ""];
  // ວັນທີ format ຢູ່ server — Intl ຂອງ browser ບໍ່ມີພາສາລາວ
  const items: ProofCard[] = (await listProofQueue()).map((p) => ({
    paymentId: p.paymentId,
    bookingCode: p.bookingCode,
    visitDateLabel: formatVisitDate(p.visitDate, locale),
    totalLabel: formatKip(p.total, dict.common.kip),
    customerName: p.customerName,
    customerPhone: p.customerPhone,
    waitedLabel: t(dict.common.minutesAgo, { n: p.waitedMinutes }),
  }));

  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <StaffHeader title={dict.common.siteName} staffName={user.fullName} locale={locale} dict={dict} />
      <StaffNav role={user.role} current="/staff/proofs" dict={dict} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        {notice && (
          <Alert className="mb-4 border-warning/40 bg-warning-subtle">
            <Construction aria-hidden className="text-warning" />
            <AlertDescription className="text-base text-foreground">{notice}</AlertDescription>
          </Alert>
        )}
        <ProofQueue items={items} dict={dict} />
      </main>
    </div>
  );
}
