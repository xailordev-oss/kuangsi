import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Lao, Noto_Sans_SC, Noto_Sans_Thai } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { hasLocale, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "../globals.css";

const notoLatin = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-noto-latin", display: "swap" });
const notoLao = Noto_Sans_Lao({ subsets: ["lao"], variable: "--font-noto-lao", display: "swap" });
const notoThai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-noto-thai", display: "swap", preload: false });
const notoSc = Noto_Sans_SC({ weight: ["400", "700"], variable: "--font-noto-sc", display: "swap", preload: false });

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.meta.title, description: dict.meta.description };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default async function LocaleLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${notoLatin.variable} ${notoLao.variable} ${notoThai.variable} ${notoSc.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
        >
          {dict.common.skipToContent}
        </a>
        <SiteHeader lang={lang} dict={dict} />
        <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-4 md:max-w-2xl">
          {children}
        </main>
        <SiteFooter lang={lang} dict={dict} />
      </body>
    </html>
  );
}
