import { Suspense } from "react";
import { AdminFrame, BarList, Section, StatTile } from "@/components/admin/admin-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { staffPage } from "@/lib/admin/page";
import { getDashboard } from "@/lib/admin/stats";
import { formatKip, formatNumber, formatVisitDate, t } from "@/lib/i18n/format";

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
  const d = await getDashboard();
  const kip = (n: number) => formatKip(n, dict.common.kip);
  const people = (n: number) => t(a.dashboard.people, { n: formatNumber(n) });

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin" title={a.dashboard.title}>
      <p className="text-muted-foreground">{t(a.dashboard.today, { date: formatVisitDate(d.date, locale) })}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={a.dashboard.entered} value={people(d.enteredPeople)} hint={a.dashboard.enteredHint} />
        <StatTile label={a.dashboard.booked} value={people(d.bookedPeople)} hint={a.dashboard.bookedHint} />
        {/* ຜູ້ຈັດການທຽບກັບເງິນໃນລິ້ນຊັກ → ບອກພື້ນຖານການນັບໃຕ້ຫົວຂໍ້ສະເໝີ (P10-1) */}
        <StatTile label={a.dashboard.revenue} value={kip(d.revenue)} hint={a.dashboard.revenueBasis} />
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
      <Section title={a.dashboard.byMethod} hint={a.dashboard.revenueBasis}>
        {d.revenueByMethod.length === 0 ? (
          <p className="text-muted-foreground">{a.dashboard.noRevenue}</p>
        ) : (
          <BarList
            label={a.dashboard.byMethod}
            rows={d.revenueByMethod.map((m) => ({ label: a.method[m.key], value: m.amount, display: kip(m.amount) }))}
          />
        )}
      </Section>
    </AdminFrame>
  );
}
