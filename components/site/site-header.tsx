import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-2 md:max-w-2xl">
        <Link href={`/${lang}`} className="flex min-h-11 items-center text-lg font-bold text-primary">
          {dict.common.siteName}
        </Link>
        {/* useSearchParams ຕ້ອງຢູ່ໃນ Suspense (cacheComponents) */}
        <Suspense fallback={<span className="flex min-h-11 items-center text-sm">{LOCALE_NAMES[lang]}</span>}>
          <LanguageSwitcher current={lang} label={dict.nav.language} />
        </Suspense>
      </div>
    </header>
  );
}
