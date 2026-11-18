import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame, StatusPill } from "@/components/admin/admin-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { bookingFiltersSchema, listBookings, type BookingFilters } from "@/lib/admin/bookings";
import { staffPage } from "@/lib/admin/page";
import { formatKip, formatNumber, formatVisitDate, t } from "@/lib/i18n/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const STATUSES = ["pending", "verifying", "paid", "used", "cancelled", "expired"] as const;
const CHANNELS = ["online", "gate", "tour_agency"] as const;
const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-base";

export default function AdminBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <BookingsView searchParams={searchParams} />
    </Suspense>
  );
}

function pageHref(f: BookingFilters, page: number) {
  const p = new URLSearchParams();
  for (const k of ["q", "from", "to", "status", "channel"] as const) if (f[k]) p.set(k, String(f[k]));
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/admin/bookings${qs ? `?${qs}` : ""}`;
}

async function BookingsView({ searchParams }: { searchParams: SearchParams }) {
  const { user, locale, dict } = await staffPage("booking.read", "/admin/bookings");
  const a = dict.admin;
  const raw = await searchParams;
  const f = bookingFiltersSchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const fullPhone = user.role === "admin";
  const { rows, total, pages } = await listBookings(f, fullPhone);
  const filtered = Boolean(f.q || f.from || f.to || f.status || f.channel);

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/bookings" title={a.bookings.title}>
      <form method="get" className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 md:grid-cols-6">
        <label className="col-span-2 flex flex-col gap-1 md:col-span-2">
          <span className="sr-only">{a.bookings.search}</span>
          <Input name="q" defaultValue={f.q ?? ""} placeholder={a.bookings.search} className="min-h-11 text-base" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.bookings.from}</span>
          <Input type="date" name="from" defaultValue={f.from ?? ""} className="min-h-11 text-base" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.bookings.to}</span>
          <Input type="date" name="to" defaultValue={f.to ?? ""} className="min-h-11 text-base" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.bookings.status}</span>
          <select name="status" defaultValue={f.status ?? ""} className={selectClass}>
            <option value="">{a.bookings.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {a.status[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{a.bookings.channel}</span>
          <select name="channel" defaultValue={f.channel ?? ""} className={selectClass}>
            <option value="">{a.bookings.all}</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {a.channel[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-6">
          <Button type="submit" className="min-h-11 flex-1 text-base md:flex-none">
            {a.bookings.apply}
          </Button>
          {filtered && (
            <Button asChild variant="ghost" className="min-h-11 text-base">
              <Link href="/admin/bookings">{a.bookings.clear}</Link>
            </Button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
        <span>{t(a.bookings.count, { n: formatNumber(total) })}</span>
        {!fullPhone && <span>{a.bookings.maskedHint}</span>}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
          <p>{a.bookings.empty}</p>
          {filtered && (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/admin/bookings">{a.bookings.clear}</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.code}>
              <Link href={`/admin/bookings/${r.code}`} className="flex flex-col gap-1 rounded-lg border bg-card p-3 hover:border-primary">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-bold">{r.code}</span>
                  <StatusPill status={r.status} label={a.status[r.status]} />
                </span>
                <span className="text-sm">
                  {r.customerName ? `${r.customerName}${r.phone ? ` · ${r.phone}` : ""}` : a.bookings.noCustomer}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatVisitDate(r.visitDate, locale, { weekday: undefined, month: "short" })} · {t(a.bookings.people, { n: r.people })} ·{" "}
                  {formatKip(r.total, dict.common.kip)} · {a.channel[r.channel]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2">
          {f.page > 1 ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={pageHref(f, f.page - 1)}>{a.bookings.prev}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">{t(a.bookings.page, { page: f.page, pages })}</span>
          {f.page < pages ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={pageHref(f, f.page + 1)}>{a.bookings.next}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AdminFrame>
  );
}
