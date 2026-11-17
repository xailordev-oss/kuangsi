"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";

// ປ່ຽນພາສາໂດຍຮັກສາໜ້າປັດຈຸບັນໄວ້ (/lo/book → /en/book)
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function change(next: string) {
    const rest = pathname.split("/").slice(2).join("/");
    const query = searchParams.toString();
    router.push(`/${next}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`);
  }

  return (
    <label className="flex min-h-11 items-center gap-1.5 text-sm">
      <Languages aria-hidden className="size-4 text-muted-foreground" />
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        className="min-h-11 rounded-md border border-input bg-background px-2 text-base"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
