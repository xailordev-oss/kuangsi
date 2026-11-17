import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { OnlineClosedNotice } from "@/components/booking/online-closed-notice";
import { ReviewConfirm } from "@/components/booking/review-confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { getCatalog } from "@/lib/booking/catalog";
import { getLakPerUnit } from "@/lib/exchange";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export default async function ReviewPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <BookingStepper step={3} dict={dict} />
      <h1 className="sr-only">{dict.review.title}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <StepThree lang={lang} dict={dict} />
      </Suspense>
    </>
  );
}

async function StepThree({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  await connection();
  const [catalog, rates] = await Promise.all([getCatalog(), getLakPerUnit()]);
  // ຂໍ້ຕົກລົງ 28: ບັນຊີທະນາຄານຍັງເປັນ TODO → ເຊື່ອງວິທີໂອນ ແລະ ບອກໃຫ້ຊື້ທີ່ປະຕູ
  if (!catalog.onlineBookingOpen) return <OnlineClosedNotice dict={dict} />;
  return <ReviewConfirm catalog={catalog} rates={rates} lang={lang} dict={dict} />;
}
