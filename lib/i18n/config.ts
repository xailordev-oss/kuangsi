export const LOCALES = ["lo", "en", "zh", "th"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "lo";

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

// ຊື່ພາສາເປັນພາສາຂອງມັນເອງ (endonym) — ບໍ່ຕ້ອງແປ
export const LOCALE_NAMES: Record<Locale, string> = {
  lo: "ລາວ",
  en: "English",
  zh: "中文",
  th: "ไทย",
};

export const INTL_LOCALE: Record<Locale, string> = {
  lo: "lo-LA",
  en: "en-GB",
  zh: "zh-CN",
  th: "th-TH",
};
