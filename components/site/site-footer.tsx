import Link from "next/link";
import { Suspense } from "react";
import { TranslationDraftNotice } from "@/components/site/translation-draft-notice";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className="border-t">
      <nav className="mx-auto flex w-full max-w-xl flex-wrap gap-x-6 px-4 py-4 text-sm md:max-w-2xl">
        <Link href={`/${lang}/lookup`} className="flex min-h-11 items-center underline-offset-4 hover:underline">
          {dict.nav.lookup}
        </Link>
        <Link href={`/${lang}/privacy`} className="flex min-h-11 items-center underline-offset-4 hover:underline">
          {dict.nav.privacy}
        </Link>
      </nav>
      <Suspense fallback={null}>
        <TranslationDraftNotice lang={lang} text={dict.common.translationDraft} />
      </Suspense>
    </footer>
  );
}
