import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { DetailsForm } from "@/components/booking/details-form";
import { OnlineClosedNotice } from "@/components/booking/online-closed-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { getCatalog } from "@/lib/booking/catalog";
import { countryNamesFor } from "@/lib/country-names";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export default async function DetailsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <BookingStepper step={2} dict={dict} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <StepTwo lang={lang} dict={dict} />
      </Suspense>
    </>
  );
}

async function StepTwo({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  await connection();
  const { onlineBookingOpen } = await getCatalog();
  if (!onlineBookingOpen) return <OnlineClosedNotice dict={dict} />;
  return (
    <DetailsForm lang={lang} dict={dict} countryNames={countryNamesFor(lang)} englishCountryNames={countryNamesFor("en")} />
  );
}
