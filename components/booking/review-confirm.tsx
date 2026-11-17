"use client";

import { Landmark, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApproxPrice } from "@/components/booking/approx-price";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Catalog } from "@/lib/booking/catalog";
import { clearDraft, useDraft } from "@/lib/booking/draft";
import { previewQuote } from "@/lib/booking/ui";
import type { DisplayCurrency } from "@/lib/exchange";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { DateLabels } from "@/lib/i18n/date-labels";
import { formatFullDate } from "@/lib/i18n/date-parts";
import { formatKip, t } from "@/lib/i18n/format";

type ApiError = { error: string; left?: number; max?: number; retryAfterSeconds?: number; reason?: string };

function errorMessage(e: ApiError, dict: Dictionary, catalog: Catalog): string {
  switch (e.error) {
    case "sold_out":
      return e.left ? t(dict.booking.overCapacity, { n: e.left }) : dict.review.capacityChanged;
    case "date_closed":
      return e.reason === "beyond_booking_window"
        ? t(dict.booking.beyondWindow, { days: catalog.maxAdvanceDays })
        : e.reason && e.reason in dict.booking.closedReasons
          ? dict.booking.closedReasons[e.reason as keyof Dictionary["booking"]["closedReasons"]]
          : dict.review.capacityChanged;
    case "too_many_people":
      return t(dict.booking.tooManyPeople, { max: e.max ?? catalog.maxPeoplePerBooking });
    case "nothing_to_pay":
      return dict.booking.nothingToPay;
    case "rate_limited":
      return t(dict.booking.rateLimited, { minutes: Math.ceil((e.retryAfterSeconds ?? 60) / 60) });
    case "online_booking_unavailable":
      return `${dict.onlineClosed.title} — ${dict.onlineClosed.body}`;
    default:
      return dict.review.errCreate;
  }
}

export function ReviewConfirm({
  catalog,
  rates,
  lang,
  dict,
  dateLabels,
}: {
  catalog: Catalog;
  rates: Partial<Record<DisplayCurrency, number>>;
  lang: Locale;
  dict: Dictionary;
  dateLabels: DateLabels;
}) {
  const router = useRouter();
  const { draft, ready } = useDraft({ group: "lao", tickets: {}, addOns: {} });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Skeleton className="h-96 w-full" />;

  const quote = previewQuote(catalog, draft, lang);
  const customer = draft.customer;
  if (!draft.visitDate || !customer || quote.people === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p>{dict.review.missingDraft}</p>
        <Button asChild className="min-h-11 text-base">
          <Link href={`/${lang}/book`}>{dict.booking.startOver}</Link>
        </Button>
      </div>
    );
  }

  async function confirm() {
    if (!draft.visitDate || !customer) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate: draft.visitDate,
          items: quote.ticketLines.map((l) => ({ ticketTypeId: l.id, quantity: l.quantity })),
          addOns: quote.addOnLines.map((l) => ({ addOnId: l.id, quantity: l.quantity })),
          customer: {
            fullName: customer.fullName,
            phone: customer.phone,
            email: customer.email,
            nationality: customer.nationality,
            idType: customer.idType,
            idNumber: customer.idNumber,
          },
        }),
      });
      const body = await res.json().catch(() => ({ error: "internal" }));
      if (res.status === 201) {
        clearDraft();
        router.push(`/${lang}/booking/${body.bookingCode}`);
        return;
      }
      setError(errorMessage(body as ApiError, dict, catalog));
    } catch {
      setError(dict.error.network);
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Row label={dict.review.visitDate} edit={`/${lang}/book`} editLabel={dict.common.edit}>
            {formatFullDate(dateLabels, draft.visitDate)}
          </Row>
          <Row label={dict.review.bookedBy} edit={`/${lang}/book/details`} editLabel={dict.common.edit}>
            {customer.fullName}
            <span className="block text-muted-foreground tabular-nums">{customer.phone}</span>
          </Row>
          <Separator />
          <ul className="flex flex-col gap-1">
            {[...quote.ticketLines, ...quote.addOnLines].map((l) => (
              <li key={l.id + l.label} className="flex justify-between gap-3">
                <span>
                  {l.label} × {l.quantity}
                </span>
                <span className="tabular-nums">{formatKip(l.lineTotal, dict.common.kip)}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex items-start justify-between gap-3">
            <span className="text-lg font-semibold">{dict.review.total}</span>
            <span className="text-end">
              <span className="block text-lg font-semibold tabular-nums">{formatKip(quote.total, dict.common.kip)}</span>
              <ApproxPrice lak={quote.total} rates={rates} lang={lang} approxLabel={dict.common.approx} />
            </span>
          </div>
          {lang !== "lo" && Object.keys(rates).length > 0 && <p className="text-sm text-muted-foreground">{dict.common.lakOnly}</p>}
        </CardContent>
      </Card>

      {/* ຂໍ້ຕົກລົງ 14: ໂອນເທົ່ານັ້ນ — ບໍ່ມີຕົວເລືອກຈ່າຍ · ຂໍ້ຄວາມ "ໂອນບໍ່ໄດ້?" ເປັນ <p> ທຳມະດາ */}
      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Landmark aria-hidden className="size-5 text-primary" />
          {dict.review.payTransfer}
        </h2>
        <p>{dict.review.paySteps}</p>
        <p className="text-sm text-muted-foreground">{dict.review.cantTransfer}</p>
        <p className="text-sm">ⓘ {t(dict.review.holdNotice, { minutes: catalog.bookingHoldMinutes })}</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2 md:max-w-2xl">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" className="min-h-12 w-full text-base" disabled={submitting} onClick={confirm}>
            {submitting && <Loader2 aria-hidden className="animate-spin" />}
            {t(dict.review.confirm, { total: formatKip(quote.total, dict.common.kip) })}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, edit, editLabel, children }: { label: string; edit: string; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p>{children}</p>
      </div>
      <Button asChild variant="link" className="min-h-11 px-0 text-base">
        <Link href={edit}>{editLabel}</Link>
      </Button>
    </div>
  );
}
