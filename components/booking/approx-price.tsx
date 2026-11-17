import type { DisplayCurrency } from "@/lib/exchange";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

// ຂໍ້ຕົກລົງ 30: ສະແດງສະເພາະພາສາທີ່ບໍ່ແມ່ນລາວ ແລະ ມີອັດຕາໃນລະບົບ · ໝາຍ "ປະມານ" ສະເໝີ
export function ApproxPrice({
  lak,
  rates,
  lang,
  approxLabel,
  className,
}: {
  lak: number;
  rates: Partial<Record<DisplayCurrency, number>>;
  lang: Locale;
  approxLabel: string;
  className?: string;
}) {
  if (lang === "lo" || lak <= 0) return null;
  const parts = (Object.entries(rates) as [DisplayCurrency, number][]).map(([currency, lakPerUnit]) =>
    new Intl.NumberFormat(INTL_LOCALE[lang], {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(lak / lakPerUnit),
  );
  if (parts.length === 0) return null;
  return (
    <span className={className ?? "text-sm text-muted-foreground"}>
      ≈ {parts.join(" · ≈ ")} ({approxLabel})
    </span>
  );
}
