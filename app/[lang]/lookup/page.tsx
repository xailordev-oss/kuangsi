import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LookupForm } from "@/components/booking/lookup-form";
import { Skeleton } from "@/components/ui/skeleton";
import { countryNamesFor } from "@/lib/country-names";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function LookupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{dict.lookup.title}</h1>
      <p className="text-muted-foreground">{dict.lookup.intro}</p>
      {/* useSearchParams (?code=) ຕ້ອງຢູ່ໃນ Suspense */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LookupForm lang={lang} dict={dict} countryNames={countryNamesFor(lang)} />
      </Suspense>
    </div>
  );
}
