// ສ້າງ lib/country-names.json ຈາກ CLDR ທີ່ມາກັບ Node (Intl.DisplayNames)
// ເຫດຜົນ: ICU ຂອງ browser (ເຊັ່ນ Chrome) ບໍ່ມີຊື່ປະເທດພາສາລາວ → ສະແດງເປັນລະຫັດ "LA"
// ແລ່ນຄືນເມື່ອປ່ຽນລາຍຊື່ປະເທດ: npx tsx scripts/generate-country-names.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ISO_COUNTRIES } from "../lib/countries";

const LOCALES = { lo: "lo", en: "en", zh: "zh-CN", th: "th" } as const;

const out: Record<string, Record<string, string>> = {};
for (const [key, tag] of Object.entries(LOCALES)) {
  const names = new Intl.DisplayNames([tag], { type: "region", fallback: "none" });
  out[key] = {};
  for (const code of ISO_COUNTRIES) {
    const name = names.of(code);
    if (!name || name === code) throw new Error(`no ${tag} name for ${code} in this Node's CLDR`);
    out[key][code] = name;
  }
}

const file = join(__dirname, "..", "lib", "country-names.json");
writeFileSync(file, `${JSON.stringify({ source: `CLDR ${process.versions.cldr} (Node ${process.version})`, names: out }, null, 1)}\n`);
console.log(`wrote ${file}: ${ISO_COUNTRIES.length} countries × ${Object.keys(LOCALES).length} languages`);
