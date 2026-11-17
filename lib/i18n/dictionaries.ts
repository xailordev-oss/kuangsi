import en from "@/dictionaries/en.json";
import type { Locale } from "@/lib/i18n/config";

export type Dictionary = typeof en;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T extends object>(base: T, override: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      value && typeof value === "object" && current && typeof current === "object"
        ? merge(current as object, value as DeepPartial<object>)
        : value;
  }
  return out as T;
}

// ຈີນ ແລະ ໄທ: ຮ່າງໂດຍ agent ຍັງບໍ່ໄດ້ກວດ (ຂໍ້ຕົກລົງ 36) · key ທີ່ຂາດ → ໃຊ້ອັງກິດແທນ
// "_meta" ໃນໄຟລ໌ເປັນຂໍ້ມູນສະຖານະການແປ ບໍ່ແມ່ນຂໍ້ຄວາມ UI
function withoutMeta(m: { default: object }): DeepPartial<Dictionary> {
  const { _meta, ...rest } = m.default as Record<string, unknown>;
  void _meta;
  return rest as DeepPartial<Dictionary>;
}

const loaders: Record<Locale, () => Promise<DeepPartial<Dictionary>>> = {
  lo: () => import("@/dictionaries/lo.json").then((m) => m.default),
  en: async () => ({}),
  zh: () => import("@/dictionaries/zh.json").then(withoutMeta),
  th: () => import("@/dictionaries/th.json").then(withoutMeta),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return merge(en, await loaders[locale]());
}
