import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { RefundDesk, type QueueCard, type VoidCard } from "@/components/staff/refund-desk";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffNav } from "@/components/staff/staff-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { can, homePathForRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { formatDateTime, formatKip, t } from "@/lib/i18n/format";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";
import { listRefundQueue, listVoidableGateSales, refundDashboard } from "@/lib/refunds/cancel";

export default function RefundsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <RefundsView />
    </Suspense>
  );
}

// Phase 11 — admin + cashier (refund.process)
async function RefundsView() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect(`${STAFF_LOGIN_PATH}?callbackUrl=/staff/refunds`);
  if (!can(user.role, "refund.process")) redirect(homePathForRole(user.role));

  const locale = await getStaffLocale();
  const dict = getStaffDictionary(locale);
  const d = dict.refunds;
  const kip = (n: number) => formatKip(n, dict.common.kip);
  // ລຳດັບສຳຄັນ: listRefundQueue ລ້າງເລກບັນຊີທີ່ຄ້າງເກີນກຳນົດກ່ອນສະແດງ (ຂໍ້ຕົກລົງ 55)
  const [rows, gate, stats] = await Promise.all([listRefundQueue(), listVoidableGateSales(), refundDashboard()]);
  const queue: QueueCard[] = rows.map((r) => ({
    id: r.id,
    bookingCode: r.bookingCode,
    amountLabel: kip(r.amount),
    amountLine: t(d.amountLine, { amount: kip(r.amount), percent: r.percent, paid: kip(r.paid) }),
    cancelledLine: [t(d.cancelledAt, { time: formatDateTime(r.cancelledAt, locale) }), r.requestedBy ? t(d.byStaff, { name: r.requestedBy }) : d.byCustomer].join(" · "),
    reason: r.reason === "customer_request" ? d.customerRequest : r.reason,
    customer: [r.customerName, r.customerPhone && t(d.phone, { phone: r.customerPhone })].filter(Boolean).join(" · ") || null,
    bankName: r.bankName,
    accountNumber: r.accountNumber,
    accountName: r.accountName,
    accountLast4: r.accountLast4,
    purged: r.purged,
    stale: r.stale,
  }));
  const voids: VoidCard[] = gate.map((g) => ({
    bookingCode: g.bookingCode,
    line: t(d.posLine, { code: g.bookingCode, people: g.people, amount: kip(g.total) }),
    soldLine: t(d.soldAt, { time: formatDateTime(g.soldAt, locale), seller: g.seller ?? "—" }),
    amountLabel: kip(g.total),
  }));

  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <StaffHeader title={dict.common.siteName} staffName={user.fullName} locale={locale} dict={dict} />
      <StaffNav role={user.role} current="/staff/refunds" dict={dict} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-bold">{d.title}</h1>
        <RefundDesk queue={queue} totalLabel={t(d.queueTotal, { amount: kip(stats.pending.amount) })} voids={voids} retentionDays={stats.retentionDays} d={d} />
      </main>
    </div>
  );
}
