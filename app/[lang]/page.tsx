import { CalendarX2, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApproxPrice } from "@/components/booking/approx-price";
import { OnlineClosedNotice } from "@/components/booking/online-closed-notice";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/db";
import { getAvailability } from "@/lib/booking/availability";
import { getCatalog, type Catalog } from "@/lib/booking/catalog";
import { ageLabel, groupLabel, localizedName } from "@/lib/booking/ui";
import { getLakPerUnit } from "@/lib/exchange";
import { hasLocale, INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { formatKip, formatTime, t } from "@/lib/i18n/format";
import { todayInVientiane } from "@/lib/time";

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="img"
        aria-label={dict.home.photoAlt}
        className="aspect-[16/9] w-full rounded-xl bg-gradient-to-br from-primary-subtle via-[#ccfbf1] to-[#5eead4]"
      />
      <section>
        <h1 className="text-2xl font-bold">{dict.common.siteName}</h1>
        <p className="mt-1 text-muted-foreground">{dict.home.intro}</p>
      </section>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeLive lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

async function HomeLive({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  await connection();
  const today = todayInVientiane();
  const [catalog, [todayInfo], rates] = await Promise.all([
    getCatalog(),
    getAvailability(prisma, today, today),
    getLakPerUnit(),
  ]);
  const closedToday = todayInfo.closedReason !== null && todayInfo.closedReason !== "past";

  return (
    <>
      {closedToday && (
        <Alert className="border-destructive/40 bg-destructive-subtle">
          <CalendarX2 aria-hidden className="text-destructive" />
          <AlertTitle className="text-base">{dict.home.closedToday}</AlertTitle>
        </Alert>
      )}
      <OpeningHours catalog={catalog} lang={lang} dict={dict} />
      <PriceList catalog={catalog} rates={rates} lang={lang} dict={dict} />
      <p className="text-sm text-muted-foreground">{dict.common.lakOnly}</p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2 md:max-w-2xl">
          {catalog.onlineBookingOpen ? (
            <Button asChild size="lg" className="min-h-12 w-full text-base">
              <Link href={`/${lang}/book`}>{dict.booking.cta}</Link>
            </Button>
          ) : (
            <OnlineClosedNotice dict={dict} />
          )}
          <Button asChild variant="ghost" className="min-h-11 w-full text-base">
            <Link href={`/${lang}/lookup`}>{dict.booking.findMine}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function OpeningHours({ catalog, lang, dict }: { catalog: Catalog; lang: Locale; dict: Dictionary }) {
  const open = catalog.operatingHours.filter((h) => !h.closed);
  const closed = catalog.operatingHours.filter((h) => h.closed);
  // ສະແດງເວລາທີ່ພົບຫຼາຍທີ່ສຸດ + ວັນປິດ
  const common = open.length ? open.reduce((best, h) =>
    open.filter((x) => x.open === h.open && x.close === h.close).length >
    open.filter((x) => x.open === best.open && x.close === best.close).length ? h : best) : null;
  const weekday = new Intl.DateTimeFormat(INTL_LOCALE[lang], { weekday: "long", timeZone: "UTC" });
  // 2024-01-07 ເປັນວັນອາທິດ → dayOfWeek 0
  const dayName = (dow: number) => weekday.format(new Date(Date.UTC(2024, 0, 7 + dow)));

  return (
    <section className="flex items-start gap-3">
      <Clock aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
      <div>
        <h2 className="font-semibold">{dict.home.openHours}</h2>
        {common && <p>{t(dict.home.openDaily, { open: formatTime(common.open), close: formatTime(common.close) })}</p>}
        {closed.length > 0 && (
          <p className="text-muted-foreground">{t(dict.home.closedDays, { days: closed.map((h) => dayName(h.dayOfWeek)).join(", ") })}</p>
        )}
      </div>
    </section>
  );
}

function PriceList({
  catalog,
  rates,
  lang,
  dict,
}: {
  catalog: Catalog;
  rates: Awaited<ReturnType<typeof getLakPerUnit>>;
  lang: Locale;
  dict: Dictionary;
}) {
  if (catalog.ticketTypes.length === 0) {
    return <p className="text-muted-foreground">{dict.home.noTickets}</p>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{dict.home.prices}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(["lao", "foreigner"] as const).map((group) => {
          const rows = catalog.ticketTypes.filter((tt) => tt.visitorGroup === group);
          if (!rows.length) return null;
          return (
            <div key={group}>
              <h3 className="font-semibold text-primary">{groupLabel(group, dict)}</h3>
              <ul className="divide-y">
                {rows.map((tt) => {
                  const price = Number(tt.price);
                  const age = ageLabel(tt, dict);
                  return (
                    <li key={tt.id} className="flex items-start justify-between gap-3 py-2">
                      <div>
                        <p>{localizedName(tt.name, lang)}</p>
                        {age && <p className="text-sm text-muted-foreground">{age}</p>}
                      </div>
                      <div className="text-end">
                        <p className="font-semibold tabular-nums">{price > 0 ? formatKip(price, dict.common.kip) : dict.booking.free}</p>
                        <ApproxPrice lak={price} rates={rates} lang={lang} approxLabel={dict.common.approx} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
