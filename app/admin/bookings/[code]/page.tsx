import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame, Section, StatusPill } from "@/components/admin/admin-frame";
import { CancelBookingAdmin } from "@/components/admin/cancel-booking-admin";
import { Skeleton } from "@/components/ui/skeleton";
import { getBookingDetail } from "@/lib/admin/bookings";
import { staffPage } from "@/lib/admin/page";
import { countryNamesFor } from "@/lib/country-names";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatKip, formatVisitDate, t } from "@/lib/i18n/format";
import { cancelPreview, refundInfo } from "@/lib/refunds/cancel";

type Params = Promise<{ code: string }>;

export default function AdminBookingDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <DetailView params={params} />
    </Suspense>
  );
}

async function DetailView({ params }: { params: Params }) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).toUpperCase();
  const { user, locale, dict } = await staffPage("booking.read", `/admin/bookings/${code}`);
  const a = dict.admin;
  const b = /^KS-[A-Z0-9]{5}$/.test(code) ? await getBookingDetail(code, user.role === "admin") : null;
  const kip = (v: string) => formatKip(v, dict.common.kip);
  const when = (iso: string) => formatDateTime(iso, locale);
  const back = (
    <Link href="/admin/bookings" className="flex min-h-11 w-fit items-center gap-1 text-primary">
      <ArrowLeft aria-hidden className="size-4" />
      {a.detail.back}
    </Link>
  );

  if (!b) {
    return (
      <AdminFrame user={user} locale={locale} dict={dict} current="/admin/bookings" title={code}>
        <p>{t(a.detail.notFound, { code })}</p>
        {back}
      </AdminFrame>
    );
  }

  const country = b.customer?.nationality ? (countryNamesFor(locale)[b.customer.nationality] ?? b.customer.nationality) : null;
  // Phase 11: admin ຍົກເລີກໄດ້ (booking.manage) · viewer ເຫັນແຕ່ຜົນ
  const c = a.cancel;
  const canCancel = can(user.role, "booking.manage");
  const preview = canCancel && (b.status === "pending" || b.status === "paid") ? await cancelPreview(b.code, new Date(), { staff: true }) : null;
  const cancelled = b.status === "cancelled" ? await refundInfo(b.code) : null;
  const blockedWhy = canCancel && ["used", "verifying"].includes(b.status) ? c.why[b.status as "used" | "verifying"] : null;
  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/bookings" title={b.code}>
      {back}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={b.status} label={a.status[b.status]} />
        <span className="text-muted-foreground">{a.channel[b.channel]}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{a.detail.visitDate}</dt>
        <dd>{formatVisitDate(b.visitDate, locale)}</dd>
        <dt className="text-muted-foreground">{a.detail.created}</dt>
        <dd>{when(b.createdAt)}</dd>
        {b.soldBy && (
          <>
            <dt className="text-muted-foreground">{a.detail.soldBy}</dt>
            <dd>{b.soldBy}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{a.detail.customer}</dt>
        <dd>{b.customer ? [b.customer.name, b.customer.phone].filter(Boolean).join(" · ") : a.bookings.noCustomer}</dd>
        {country && (
          <>
            <dt className="text-muted-foreground">{a.detail.nationality}</dt>
            <dd>{country}</dd>
          </>
        )}
        {b.customer?.email && (
          <>
            <dt className="text-muted-foreground">{a.detail.email}</dt>
            <dd className="break-all">{b.customer.email}</dd>
          </>
        )}
      </dl>

      {preview?.cancellable && (
        <CancelBookingAdmin
          code={b.code}
          paid={preview.paid}
          paidLabel={preview.paid > 0 && preview.method ? t(c.paid, { amount: kip(String(preview.paid)), method: a.method[preview.method] }) : null}
          method={preview.method}
          policyAmount={preview.amount}
          policyLine={t(c.policy, { amount: kip(String(preview.amount)), percent: preview.percent, hours: Math.max(0, Math.floor(preview.hoursLeft)) })}
          fullLine={t(c.full, { amount: kip(String(preview.paid)) })}
          kipUnit={dict.common.kip}
          d={c}
          errors={{ ...dict.refunds.errors, cancel: dict.refunds.cancel }}
        />
      )}
      {blockedWhy && <p className="text-sm text-muted-foreground">{t(c.notAllowed, { why: blockedWhy })}</p>}
      {cancelled && (
        <Section title={c.refund}>
          <p data-testid="cancel-info">
            {t(c.cancelledInfo, { time: when(cancelled.cancelledAt), by: cancelled.cancelledBy ?? c.customer, reason: cancelled.cancelReason ?? "" })}
          </p>
          {cancelled.refund && (
            <p className="font-semibold">
              {cancelled.refund.status === "completed"
                ? t(c.refundCompleted, { amount: kip(String(cancelled.refund.amount)), time: when(cancelled.refund.completedAt!) })
                : t(c.refundRequested, { amount: kip(String(cancelled.refund.amount)), percent: cancelled.refund.percent })}
              {cancelled.refund.last4 && <span className="font-normal"> · {t(c.account, { last4: cancelled.refund.last4 })}</span>}
              {cancelled.refund.transferRef && <span className="font-normal"> · {t(c.refundRef, { ref: cancelled.refund.transferRef })}</span>}
            </p>
          )}
        </Section>
      )}

      <Section title={a.detail.items}>
        <ul className="flex flex-col gap-1">
          {b.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-2">
              <span>
                {i.name[locale]} × {i.quantity}
              </span>
              <span className="tabular-nums">{kip(i.lineTotal)}</span>
            </li>
          ))}
          {b.addOns.map((x, n) => (
            <li key={`a${n}`} className="flex justify-between gap-2">
              <span>
                {x.name[locale]} × {x.quantity}
              </span>
              <span className="tabular-nums">{kip(x.lineTotal)}</span>
            </li>
          ))}
          {Number(b.discount) > 0 && (
            <li className="flex justify-between gap-2 text-muted-foreground">
              <span>{a.detail.discount}</span>
              <span className="tabular-nums">−{kip(b.discount)}</span>
            </li>
          )}
          <li className="flex justify-between gap-2 border-t pt-1 font-semibold">
            <span>{a.detail.total}</span>
            <span className="tabular-nums">{kip(b.total)}</span>
          </li>
        </ul>
      </Section>

      <Section title={a.detail.payments}>
        {b.payments.length === 0 ? (
          <p className="text-muted-foreground">{a.detail.noPayments}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {b.payments.map((p, n) => (
              <li key={n} className="flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {a.method[p.method]} · {kip(p.amount)}
                  </span>
                  <StatusPill status={p.status} label={a.paymentStatus[p.status]} />
                </span>
                <span className="text-sm text-muted-foreground">{t(a.detail.submittedAt, { time: when(p.createdAt) })}</span>
                {p.paidAt && <span className="text-sm">{t(a.detail.paidAt, { time: when(p.paidAt) })}</span>}
                {p.verifiedBy && p.verifiedAt && (
                  <span className="text-sm">{t(a.detail.verifiedBy, { name: p.verifiedBy, time: when(p.verifiedAt) })}</span>
                )}
                {p.rejectReason && <span className="text-sm text-destructive">{t(a.detail.rejected, { reason: p.rejectReason })}</span>}
                {p.refundAmount && (
                  <span className="text-sm">{t(a.detail.refunded, { amount: kip(p.refundAmount), reason: p.refundReason ?? "" })}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={a.detail.scans}>
        {b.checkIns.length === 0 ? (
          <p className="text-muted-foreground">{a.detail.noScans}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {b.checkIns.map((c, n) => (
              <li key={n} className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{when(c.scannedAt)}</span>
                <span>{c.gate}</span>
                <StatusPill status={c.result} label={a.checkResult[c.result]} />
                {c.offline && <span className="rounded bg-offline px-1.5 text-sm text-white">{a.detail.offline}</span>}
                {c.by && <span className="text-sm text-muted-foreground">{t(a.detail.by, { name: c.by })}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AdminFrame>
  );
}
