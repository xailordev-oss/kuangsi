import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/admin-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { staffPage } from "@/lib/admin/page";
import { parseReportRange } from "@/lib/admin/report-range";
import { listOfflineDuplicates } from "@/lib/admin/stats";
import { formatDateTime, formatNumber, t } from "@/lib/i18n/format";
import { todayInVientiane } from "@/lib/time";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ScanReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <ScanReviewsView searchParams={searchParams} />
    </Suspense>
  );
}

// ຂໍ້ຕົກລົງ 39 + P10-6: ອ່ານຢ່າງດຽວ — ການ "ຮັບຮູ້" ຢູ່ເຄື່ອງສະແກນ
async function ScanReviewsView({ searchParams }: { searchParams: SearchParams }) {
  const { user, locale, dict } = await staffPage("report.read", "/admin/scan-reviews");
  const a = dict.admin.scanReviews;
  const raw = await searchParams;
  const range = parseReportRange(raw.from || raw.to ? raw : { preset: "last7" }, todayInVientiane());
  const rows = range.ok ? await listOfflineDuplicates(range.from, range.to) : [];
  const when = (iso: string) => formatDateTime(iso, locale);

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/scan-reviews" title={a.title}>
      <p className="text-muted-foreground">{a.intro}</p>
      <form method="get" className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.from}</span>
          <Input type="date" name="from" defaultValue={range.from} className="min-h-11 text-base" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.to}</span>
          <Input type="date" name="to" defaultValue={range.to} className="min-h-11 text-base" required />
        </label>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button type="submit" className="min-h-11 w-full text-base">
            {a.show}
          </Button>
        </div>
      </form>
      {!range.ok ? (
        <p role="alert" className="rounded-lg border border-warning/50 bg-warning-subtle p-3">
          {range.error === "tooLong" ? t(dict.admin.reports.tooLong, { max: 366 }) : dict.common.error}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">{a.empty}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t(a.count, { n: formatNumber(rows.length) })}</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 rounded-lg border border-warning/50 bg-warning-subtle p-3">
                <Link href={`/admin/bookings/${r.bookingCode}`} className="font-mono text-lg font-bold text-primary underline-offset-4 hover:underline">
                  {r.bookingCode}
                </Link>
                <span>
                  {t(a.offlineAt, { gate: r.gate, time: when(r.scannedAt) })}
                  {r.scannedBy && ` · ${t(a.by, { name: r.scannedBy })}`}
                </span>
                {r.first && (
                  <span className="text-sm">
                    {t(a.first, { gate: r.first.gate, time: when(r.first.scannedAt) })}
                    {r.first.by && ` · ${t(a.by, { name: r.first.by })}`}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  {r.lines.map((l) => `${l.visitorGroup === "lao" ? dict.scan.groupLao : dict.scan.groupForeigner} ${dict.scan.age[l.ageGroup]} ${l.quantity}`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminFrame>
  );
}
