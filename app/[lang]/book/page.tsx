import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookStepOne } from "@/components/booking/book-step-one";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { OnlineClosedNotice } from "@/components/booking/online-closed-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { getCatalog } from "@/lib/booking/catalog";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDateLabels } from "@/lib/i18n/date-labels";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export default async function BookPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <BookingStepper step={1} dict={dict} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <StepOne lang={lang} dict={dict} />
      </Suspense>
    </>
  );
}

async function StepOne({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  await connection();
  const catalog = await getCatalog();
  if (!catalog.onlineBookingOpen) return <OnlineClosedNotice dict={dict} />;
  return <BookStepOne catalog={catalog} lang={lang} dict={dict} dateLabels={getDateLabels(lang)} />;
}
