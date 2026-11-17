import data from "@/lib/country-names.json";
import type { Locale } from "@/lib/i18n/config";

export type CountryNames = Record<string, string>;

// ໃຊ້ຝັ່ງ server ແລ້ວສົ່ງສະເພາະພາສາທີ່ໃຊ້ຢູ່ໄປ client (ບໍ່ bundle ທັງ 4 ພາສາ)
// ຂໍ້ມູນສ້າງຈາກ CLDR: npx tsx scripts/generate-country-names.ts
export function countryNamesFor(locale: Locale): CountryNames {
  return data.names[locale];
}
