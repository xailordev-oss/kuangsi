import { Suspense } from "react";
import { AdminFrame, FlowTable, Section, StatTile } from "@/components/admin/admin-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { staffPage } from "@/lib/admin/page";
import { flowRows } from "@/lib/admin/report-view";
import { getDashboard } from "@/lib/admin/stats";
import { formatKip, formatNumber, formatVisitDate, t } from "@/lib/i18n/format";
import { refundDashboard } from "@/lib/refunds/cancel";

export default function AdminHomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 p-4 md:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

async function Dashboard() {
  const { user, locale, dict } = await staffPage("report.read", "/admin");
  const a = dict.admin;
  const [d, r] = await Promise.all([getDashboard(), refundDashboard()]);
  const kip = (n: number) => formatKip(n, dict.common.kip);
  const people = (n: number) => t(a.dashboard.people, { n: formatNumber(n) });

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin" title={a.dashboard.title}>
      <p className="text-muted-foreground">{t(a.dashboard.today, { date: formatVisitDate(d.date, locale) })}</p>
      {/* ຂໍ້ຕົກລົງ 44: ຮັບ · ຄືນ · ສຸດທິ ແຍກກັນ ພ້ອມພື້ນຖານການນັບໃຕ້ຫົວຂໍ້ (ຜູ້ຈັດການທຽບກັບເງິນໃນລິ້ນຊັກ) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label={a.dashboard.received} value={kip(d.money.received)} hint={a.dashboard.receivedBasis} />
        <StatTile label={a.dashboard.refunded} value={kip(d.money.refunded)} hint={a.dashboard.refundedBasis} tone={d.money.refunded > 0 ? "warn" : "default"} />
        <StatTile label={a.dashboard.net} value={kip(d.money.net)} hint={a.dashboard.netHint} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={a.dashboard.entered} value={people(d.enteredPeople)} hint={a.dashboard.enteredHint} />
        <StatTile label={a.dashboard.booked} value={people(d.bookedPeople)} hint={a.dashboard.bookedHint} />
        <StatTile label={a.dashboard.left} value={d.closedToday ? a.dashboard.closedToday : formatNumber(d.left)} />
        <StatTile
          label={a.dashboard.pendingProofs}
          value={formatNumber(d.pendingProofs)}
          tone={d.pendingProofs > 0 ? "warn" : "default"}
          href={user.role === "admin" ? "/staff/proofs" : undefined}
        />
        <StatTile
          label={a.dashboard.offlineDuplicates}
          value={formatNumber(d.offlineDuplicates)}
          tone={d.offlineDuplicates > 0 ? "warn" : "default"}
          href="/admin/scan-reviews"
        />
      </div>
      {/* Phase 11: ຂໍ້ຕົກລົງ 57 (ເງິນສົດຄືນບໍ່ມີຮ່ອງຮອຍທະນາຄານ → ສະແດງແຍກ ສີເຫຼືອງເມື່ອ > 0) · ຂໍ້ຕົກລົງ 55 (ຄ້າງເກີນກຳນົດ) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="refund-tiles">
        <StatTile
          label={a.dashboard.posVoids}
          value={kip(r.posVoidsToday.amount)}
          hint={t(a.dashboard.posVoidsHint, { n: r.posVoidsToday.count })}
          tone={r.posVoidsToday.count > 0 ? "warn" : "default"}
        />
        <StatTile
          label={a.dashboard.refundsPending}
          value={kip(r.pending.amount)}
          hint={t(a.dashboard.refundsPendingHint, { n: r.pending.count })}
          tone={r.pending.count > 0 ? "warn" : "default"}
          href={user.role === "admin" ? "/staff/refunds" : undefined}
        />
        <StatTile
          label={t(a.dashboard.refundsStale, { days: r.retentionDays })}
          value={formatNumber(r.pending.stale)}
          hint={a.dashboard.refundsStaleHint}
          tone={r.pending.stale > 0 ? "warn" : "default"}
          href={user.role === "admin" ? "/staff/refunds" : undefined}
        />
      </div>
      <Section title={a.dashboard.byMethod} hint={a.reports.moneyBasis}>
        {d.byMethod.length === 0 ? (
          <p className="text-muted-foreground">{a.dashboard.noRevenue}</p>
        ) : (
          <FlowTable
            caption={a.dashboard.byMethod}
            heads={{ received: a.reports.received, refunded: a.reports.refunded, net: a.reports.net, unit: dict.common.kip }}
            rows={flowRows(d.byMethod, (k) => a.method[k as keyof typeof a.method])}
            total={{ label: a.reports.total, ...d.money }}
          />
        )}
      </Section>
    </AdminFrame>
  );
}
