import { CircleCheck, Info, KeyRound, Landmark, Search, TriangleAlert, Upload } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { CopyButton } from "@/components/booking/copy-button";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { OnlineClosedNotice } from "@/components/booking/online-closed-notice";
import { ProofUploader } from "@/components/booking/proof-uploader";
import { QrTicket } from "@/components/booking/qr-ticket";
import { OfflinePage } from "@/components/site/sw-register";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { hasBookingAccess } from "@/lib/booking/access";
import { findBookingByCode, toCustomerBookingDto } from "@/lib/booking/read";
import { bookingCodeSchema } from "@/lib/booking/schemas";
import { localizedName } from "@/lib/booking/ui";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { formatKip, formatVisitDate, t } from "@/lib/i18n/format";
import { getBankTransferInfo } from "@/lib/settings";

type Params = Promise<{ lang: string; code: string }>;

// code ບໍ່ຮູ້ລ່ວງໜ້າ ແລະ ຕ້ອງອ່ານ cookie → render ຕອນມີ request ພາຍໃນ Suspense (cacheComponents)
export default function BookingPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BookingView params={params} />
    </Suspense>
  );
}

async function BookingView({ params }: { params: Params }) {
  await connection();
  const { lang, code: rawCode } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const parsed = bookingCodeSchema.safeParse(rawCode);
  const code = parsed.success ? parsed.data : null;

  // ຂໍ້ຕົກລົງ 19: ບໍ່ມີສິດ ຫຼື ບໍ່ພົບ → ໜ້າດຽວກັນ (ບໍ່ບອກວ່າລະຫັດມີຢູ່)
  const booking = code && (await hasBookingAccess(code)) ? await findBookingByCode(code) : null;
  if (!booking) return <AccessNotice lang={lang} dict={dict} code={code} />;

  const b = toCustomerBookingDto(booking);
  const bank = b.status === "pending" || b.status === "verifying" ? await getBankTransferInfo() : null;

  return (
    <>
      <BookingStepper step={4} dict={dict} />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold tabular-nums">{b.bookingCode}</h1>
          <BookingStatusBadge status={b.status} dict={dict} />
        </div>

        {b.status === "pending" && (
          <>
            {b.expiresAt && <HoldCountdown expiresAt={b.expiresAt} template={dict.pay.timeLeft} />}
            {b.lastRejectReason && (
              <Alert className="border-destructive/40 bg-destructive-subtle">
                <TriangleAlert aria-hidden className="text-destructive" />
                <AlertDescription className="text-base text-foreground">
                  {t(dict.pay.rejected, { reason: b.lastRejectReason })}
                </AlertDescription>
              </Alert>
            )}
            {bank?.configured ? (
              <section className="flex flex-col gap-3 rounded-xl border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Landmark aria-hidden className="size-5 text-primary" />
                  {t(dict.pay.stepTransfer, { amount: formatKip(b.total, dict.common.kip) })}
                </h2>
                <dl className="flex flex-col gap-2">
                  <BankRow label={dict.pay.bank} value={bank.bankName} />
                  <div className="flex items-end justify-between gap-2">
                    <BankRow label={dict.pay.accountNumber} value={bank.accountNumber} mono />
                    <CopyButton value={bank.accountNumber} label={dict.common.copy} copiedLabel={dict.common.copied} />
                  </div>
                  <BankRow label={dict.pay.accountName} value={bank.accountName} />
                </dl>
                <Separator />
                <h2 className="flex items-center gap-2 font-semibold">
                  <Upload aria-hidden className="size-5 text-primary" />
                  {dict.pay.stepUpload}
                </h2>
                <ProofUploader bookingCode={b.bookingCode} dict={dict} />
              </section>
            ) : (
              <OnlineClosedNotice dict={dict} />
            )}
            <p className="flex items-center gap-2 rounded-xl bg-primary-subtle p-3 font-semibold">
              <KeyRound aria-hidden className="size-5 text-primary" />
              {t(dict.pay.rememberCode, { code: b.bookingCode })}
            </p>
          </>
        )}

        {b.status === "verifying" && (
          <Alert className="border-warning/40 bg-warning-subtle">
            <Search aria-hidden className="text-warning" />
            <AlertTitle className="text-base">{dict.pay.verifying}</AlertTitle>
            <AlertDescription className="text-base text-foreground">
              <p>{dict.pay.verifyingNoExpiry}</p>
              {bank?.configured && <p>{t(dict.pay.verifyTime, { note: bank.verifyTimeNote[lang] })}</p>}
              <p className="text-muted-foreground">{dict.pay.verifyingHint}</p>
            </AlertDescription>
          </Alert>
        )}
        {b.status === "verifying" && (
          // eslint-disable-next-line @next/next/no-img-element -- ຮູບສ່ວນຕົວຜ່ານ API ທີ່ກວດສິດ (ບໍ່ຜ່ານ image optimizer)
          <img
            src={`/api/public/bookings/${b.bookingCode}/proof`}
            alt={dict.pay.proofAlt}
            className="max-h-64 w-full rounded-xl border object-contain"
          />
        )}

        {b.status === "paid" && (
          <>
            <Alert className="border-success/40 bg-success-subtle">
              <CircleCheck aria-hidden className="text-success" />
              <AlertTitle className="text-base">{dict.ticket.ready}</AlertTitle>
            </Alert>
            {b.qrToken && <QrTicket qrToken={b.qrToken} bookingCode={b.bookingCode} dict={dict} />}
            <p className="text-sm text-muted-foreground">{dict.ticket.offlineOk}</p>
            {/* ຂໍ້ຕົກລົງ 34: ເກັບໜ້າ QR ໄວ້ເປີດຕອນເນັດຂາດ (ສະເພາະຫຼັງຈ່າຍແລ້ວ) */}
            <OfflinePage />
          </>
        )}

        {b.status === "used" && <p className="text-lg">{dict.ticket.used}</p>}

        {(b.status === "expired" || b.status === "cancelled") && (
          <div className="flex flex-col gap-3">
            <p className="text-lg">{b.status === "expired" ? dict.pay.expired : dict.ticket.cancelled}</p>
            <Button asChild className="min-h-11 text-base">
              <Link href={`/${lang}/book`}>{dict.booking.startOver}</Link>
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{dict.review.visitDate}</p>
              <p className="font-semibold">{formatVisitDate(b.visitDate, lang)}</p>
            </div>
            <Separator />
            <ul className="flex flex-col gap-1">
              {b.items.map((i) => (
                <li key={i.ticketTypeCode} className="flex justify-between gap-3">
                  <span>
                    {localizedName(i.name, lang)} × {i.quantity}
                  </span>
                  <span className="tabular-nums">{formatKip(i.lineTotal, dict.common.kip)}</span>
                </li>
              ))}
              {b.addOns.map((a) => (
                <li key={a.addOnCode} className="flex justify-between gap-3">
                  <span>
                    {localizedName(a.name, lang)} × {a.quantity}
                  </span>
                  <span className="tabular-nums">{formatKip(a.lineTotal, dict.common.kip)}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex justify-between text-lg font-semibold">
              <span>{dict.review.total}</span>
              <span className="tabular-nums">{formatKip(b.total, dict.common.kip)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function BankRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={mono ? "text-lg font-semibold tabular-nums tracking-wide" : "font-semibold"}>{value}</dd>
    </div>
  );
}

function AccessNotice({ lang, dict, code }: { lang: Locale; dict: Dictionary; code: string | null }) {
  return (
    <div className="flex flex-col gap-4 py-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Info aria-hidden className="size-6 text-primary" />
        {dict.access.title}
      </h1>
      <p>{dict.access.body}</p>
      <Button asChild className="min-h-11 text-base">
        <Link href={`/${lang}/lookup${code ? `?code=${encodeURIComponent(code)}` : ""}`}>{dict.access.goLookup}</Link>
      </Button>
    </div>
  );
}
