"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ISO_COUNTRIES, SHORTCUT_COUNTRIES } from "@/lib/countries";
import type { CountryNames } from "@/lib/country-names";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Labels = { none: string; search: string; common: string; all: string; noMatch: string; change: string };

// ສັນຊາດ: ISO 3166 ຄົບ 249 ປະເທດ + ຊ່ອງຄົ້ນຫາ · 11 ປະເທດທີ່ໃຊ້ເລື້ອຍຢູ່ເທິງ (ຂໍ້ຕົກລົງ 31)
// ຄົ້ນຫາໄດ້ທັງຊື່ຕາມພາສາທີ່ເລືອກ, ຊື່ອັງກິດ ແລະ ລະຫັດປະເທດ
// ຊື່ມາຈາກ server (CLDR) — ບໍ່ໃຊ້ Intl.DisplayNames ຂອງ browser ເພາະ Chrome ບໍ່ມີຊື່ພາສາລາວ
export function CountryPicker({
  id,
  value,
  onChange,
  lang,
  names,
  englishNames,
  labels,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  lang: Locale;
  names: CountryNames;
  englishNames: CountryNames;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();

  const countries = useMemo(() => {
    const collator = new Intl.Collator(INTL_LOCALE[lang]);
    return ISO_COUNTRIES.map((code) => ({ code, name: names[code] ?? code, en: englishNames[code] ?? code })).sort((a, b) =>
      collator.compare(a.name, b.name),
    );
  }, [lang, names, englishNames]);
  const byCode = useMemo(() => new Map(countries.map((c) => [c.code as string, c])), [countries]);

  const q = query.trim().toLowerCase();
  const matches = q
    ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.en.toLowerCase().includes(q) || c.code.toLowerCase() === q)
    : countries;

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  const option = (code: string, label: string, group: string) => (
    <li key={`${group}-${code || "none"}`}>
      <button
        type="button"
        aria-pressed={value === code}
        onClick={() => pick(code)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-start text-base hover:bg-accent",
          value === code && "bg-primary-subtle font-semibold",
        )}
      >
        {label}
        {value === code && <Check aria-hidden className="size-4 text-primary" />}
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-2">
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center justify-between rounded-md border border-input bg-background px-3 text-start text-base"
      >
        <span>{value ? (byCode.get(value)?.name ?? value) : labels.none}</span>
        <span className="sr-only">{labels.change}</span>
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div id={listId} className="flex flex-col gap-2 rounded-xl border p-2">
          <label className="relative">
            <span className="sr-only">{labels.search}</span>
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.search}
              className="min-h-11 ps-9 text-base"
            />
          </label>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {!q && option("", labels.none, "none")}
            {!q && (
              <>
                <li aria-hidden className="px-3 pt-2 text-sm font-semibold text-muted-foreground">
                  {labels.common}
                </li>
                {SHORTCUT_COUNTRIES.map((code) => option(code, byCode.get(code)?.name ?? code, "common"))}
                <li aria-hidden className="px-3 pt-2 text-sm font-semibold text-muted-foreground">
                  {labels.all}
                </li>
              </>
            )}
            {matches.map((c) => option(c.code, c.name, "all"))}
            {q && matches.length === 0 && (
              <li role="status" className="px-3 py-2 text-muted-foreground">
                {labels.noMatch}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
