import { connection } from "next/server";
import type { Locale } from "@/lib/i18n/config";
import { getBoolSetting } from "@/lib/settings";

// ຂໍ້ຕົກລົງ 36: ຄຳແປຈີນ/ໄທ ຮ່າງໂດຍ agent — ບອກຜູ້ໃຊ້ຈົນກວ່າເຈົ້າຂອງພາສາກວດ (settings → 'true')
export async function TranslationDraftNotice({ lang, text }: { lang: Locale; text: string }) {
  if (lang !== "zh" && lang !== "th") return null;
  await connection();
  const reviewed = await getBoolSetting(lang === "zh" ? "translations_reviewed_zh" : "translations_reviewed_th").catch(() => false);
  if (reviewed) return null;
  return <p className="mx-auto w-full max-w-xl px-4 pb-4 text-sm text-muted-foreground md:max-w-2xl">ⓘ {text}</p>;
}
