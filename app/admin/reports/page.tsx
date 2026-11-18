import { Download } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame, BarList, FlowTable, Section } from "@/components/admin/admin-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { staffPage } from "@/lib/admin/page";
import { MAX_REPORT_DAYS, parseReportRange, PRESETS } from "@/lib/admin/report-range";
import { reportSections } from "@/lib/admin/report-view";
import { getReport } from "@/lib/admin/stats";
import { formatVisitDate, t } from "@/lib/i18n/format";
import { todayInVientiane } from "@/lib/time";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <ReportsView searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsView({ searchParams }: { searchParams: SearchParams }) {
  const { user, locale, dict } = await staffPage("report.read", "/admin/reports");
  const a = dict.admin.reports;
  const range = parseReportRange(await searchParams, todayInVientiane());
  const report = range.ok ? await getReport(range) : null;
  const sections = report ? reportSections(report, dict, locale) : [];
  const csvHref = `/api/admin/reports?${new URLSearchParams({ from: range.from, to: range.to, groupBy: range.groupBy })}`;
  const date = (iso: string) => formatVisitDate(iso, locale, { weekday: undefined, month: "short" });

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/reports" title={a.title}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p} asChild variant={range.ok && range.preset === p ? "default" : "outline"} className="min-h-11">
            <Link href={`/admin/reports?preset=${p}`}>{a[p]}</Link>
          </Button>
        ))}
      </div>
      <form method="get" className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.from}</span>
          <Input type="date" name="from" defaultValue={range.from} className="min-h-11 text-base" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.to}</span>
          <Input type="date" name="to" defaultValue={range.to} className="min-h-11 text-base" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.groupBy}</span>
          <select name="groupBy" defaultValue={range.groupBy} className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-base">
            {(["day", "month", "year"] as const).map((g) => (
              <option key={g} value={g}>
                {a[g]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" className="min-h-11 w-full text-base">
            {a.show}
          </Button>
        </div>
      </form>

      {!range.ok ? (
        <p role="alert" className="rounded-lg border border-warning/50 bg-warning-subtle p-3">
          {range.error === "tooLong" ? t(a.tooLong, { max: MAX_REPORT_DAYS }) : dict.common.error}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{t(a.range, { from: date(range.from), to: date(range.to) })}</p>
            <div className="flex flex-col items-end">
              <Button asChild variant="outline" className="min-h-11">
                <a href={csvHref} download>
                  <Download aria-hidden />
                  {a.download}
                </a>
              </Button>
              <span className="text-xs text-muted-foreground">{a.downloadHint}</span>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map((s) => (
              <div key={s.id} className={cn(s.id === "money" && "md:col-span-2")}>
                <Section title={s.title} hint={s.hint}>
                  {s.rows.length === 0 ? (
                    <p className="text-muted-foreground">{a.empty}</p>
                  ) : s.kind === "flow" ? (
                    <FlowTable
                      caption={s.title}
                      heads={{ received: a.received, refunded: a.refunded, net: a.net, unit: dict.common.kip }}
                      rows={s.rows}
                      total={s.total}
                    />
                  ) : (
                    <>
                      <BarList label={s.title} rows={s.rows} />
                      {s.total && s.id !== "weekday" && s.id !== "hour" && (
                        <p className="flex justify-between border-t pt-1 font-semibold">
                          <span>{a.total}</span>
                          <span className="tabular-nums">{s.total}</span>
                        </p>
                      )}
                    </>
                  )}
                </Section>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminFrame>
  );
}
