"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DatePickerWithAvailability } from "@/components/booking/date-picker";
import { QuantityStepper } from "@/components/booking/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayAvailability } from "@/lib/booking/availability";
import type { Catalog } from "@/lib/booking/catalog";
import { useDraft, type BookingDraft } from "@/lib/booking/draft";
import { addOnMaxQuantity, ageLabel, groupLabel, localizedName, previewQuote } from "@/lib/booking/ui";
import type { Locale } from "@/lib/i18n/config";
import type { DateLabels } from "@/lib/i18n/date-labels";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatKip, t } from "@/lib/i18n/format";

export function BookStepOne({
  catalog,
  lang,
  dict,
  dateLabels,
}: {
  catalog: Catalog;
  lang: Locale;
  dict: Dictionary;
  dateLabels: DateLabels;
}) {
  const router = useRouter();
  const initial: BookingDraft = { group: lang === "lo" ? "lao" : "foreigner", tickets: {}, addOns: {} };
  const { draft, update, ready } = useDraft(initial);
  const [dayInfo, setDayInfo] = useState<DayAvailability | null>(null);
  const onDayInfo = useCallback((d: DayAvailability | null) => setDayInfo(d), []);

  const quote = previewQuote(catalog, draft, lang);

  // ຈຳນວນຄົນຫຼຸດລົງ → ບໍລິການເສີມແບບຕໍ່ຄົນຕ້ອງບໍ່ເກີນຈຳນວນຄົນ
  useEffect(() => {
    const over = catalog.addOns.filter((a) => (draft.addOns[a.id] ?? 0) > addOnMaxQuantity(a, quote.people));
    if (!over.length) return;
    update((d) => {
      const addOns = { ...d.addOns };
      for (const a of over) {
        const max = addOnMaxQuantity(a, quote.people);
        if (max > 0) addOns[a.id] = max;
        else delete addOns[a.id];
      }
      return { ...d, addOns };
    });
  }, [catalog.addOns, draft.addOns, quote.people, update]);

  if (!ready) return <Skeleton className="h-96 w-full" />;

  const groups: ("lao" | "foreigner")[] = draft.group === "mixed" ? ["lao", "foreigner"] : [draft.group];

  function setGroup(group: BookingDraft["group"]) {
    update((d) => {
      if (group === "mixed") return { ...d, group };
      // ກັບໄປກຸ່ມດຽວ → ລ້າງປີ້ຂອງອີກກຸ່ມ ບໍ່ໃຫ້ມີລາຍການທີ່ເບິ່ງບໍ່ເຫັນ
      const keep = new Set(catalog.ticketTypes.filter((tt) => tt.visitorGroup === group).map((tt) => tt.id));
      const tickets = Object.fromEntries(Object.entries(d.tickets).filter(([id]) => keep.has(id)));
      return { ...d, group, tickets };
    });
  }

  const problem = !draft.visitDate
    ? dict.booking.chooseDateFirst
    : quote.people === 0
      ? dict.booking.minOne
      : quote.total === 0
        ? dict.booking.nothingToPay
        : quote.people > catalog.maxPeoplePerBooking
          ? t(dict.booking.tooManyPeople, { max: catalog.maxPeoplePerBooking })
          : dayInfo && quote.people > dayInfo.left
            ? t(dict.booking.overCapacity, { n: dayInfo.left })
            : null;

  return (
    <div className="flex flex-col gap-6">
      <DatePickerWithAvailability
        value={draft.visitDate}
        onChange={(visitDate) => update({ visitDate })}
        onDayInfo={onDayInfo}
        maxAdvanceDays={catalog.maxAdvanceDays}
        dateLabels={dateLabels}
        dict={dict}
      />

      <section aria-labelledby="group-heading" className="flex flex-col gap-2">
        <h2 id="group-heading" className="font-semibold">
          {dict.booking.groupQuestion}
        </h2>
        {draft.group === "mixed" ? (
          <Button type="button" variant="link" className="min-h-11 justify-start px-0 text-base" onClick={() => setGroup(lang === "lo" ? "lao" : "foreigner")}>
            {dict.booking.groupSingle}
          </Button>
        ) : (
          <>
            <RadioGroup
              value={draft.group}
              onValueChange={(v) => setGroup(v as "lao" | "foreigner")}
              className="grid grid-cols-2 gap-2"
            >
              {(["lao", "foreigner"] as const).map((g) => (
                <Label
                  key={g}
                  htmlFor={`group-${g}`}
                  className="flex min-h-12 items-center gap-2 rounded-xl border px-3 text-base font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-subtle"
                >
                  <RadioGroupItem id={`group-${g}`} value={g} />
                  {groupLabel(g, dict)}
                </Label>
              ))}
            </RadioGroup>
            <Button type="button" variant="link" className="min-h-11 justify-start px-0 text-base" onClick={() => setGroup("mixed")}>
              {dict.booking.groupMixed} ›
            </Button>
          </>
        )}
      </section>

      {groups.map((group) => (
        <section key={group} aria-label={groupLabel(group, dict)} className="flex flex-col">
          {draft.group === "mixed" && <h3 className="font-semibold text-primary">{groupLabel(group, dict)}</h3>}
          <ul className="divide-y">
            {catalog.ticketTypes
              .filter((tt) => tt.visitorGroup === group)
              .map((tt) => {
                const qty = draft.tickets[tt.id] ?? 0;
                const name = localizedName(tt.name, lang);
                const age = ageLabel(tt, dict);
                const price = Number(tt.price);
                return (
                  <li key={tt.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {name}
                        {age && <span className="text-sm font-normal text-muted-foreground"> · {age}</span>}
                      </p>
                      <p className="tabular-nums text-muted-foreground">{price > 0 ? formatKip(price, dict.common.kip) : dict.booking.free}</p>
                    </div>
                    <QuantityStepper
                      value={qty}
                      max={qty + Math.max(0, catalog.maxPeoplePerBooking - quote.people)}
                      onChange={(n) =>
                        update((d) => ({ ...d, tickets: { ...d.tickets, [tt.id]: n } }))
                      }
                      decreaseLabel={t(dict.booking.decrease, { name })}
                      increaseLabel={t(dict.booking.increase, { name })}
                    />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {catalog.addOns.length > 0 && (
        <section aria-labelledby="addon-heading" className="flex flex-col gap-1">
          <h2 id="addon-heading" className="font-semibold">
            {dict.booking.addOns} <span className="text-sm font-normal text-muted-foreground">({dict.common.optional})</span>
          </h2>
          <ul className="divide-y">
            {catalog.addOns.map((a) => {
              const qty = draft.addOns[a.id] ?? 0;
              const max = addOnMaxQuantity(a, quote.people);
              const name = localizedName(a.name, lang);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Label htmlFor={`addon-${a.id}`} className="flex min-h-11 flex-1 items-center gap-3 text-base font-normal">
                    <Checkbox
                      id={`addon-${a.id}`}
                      className="size-5"
                      checked={qty > 0}
                      disabled={max === 0}
                      onCheckedChange={(checked) =>
                        update((d) => {
                          const addOns = { ...d.addOns };
                          if (checked) addOns[a.id] = a.unit === "per_person" ? Math.max(1, quote.people) : 1;
                          else delete addOns[a.id];
                          return { ...d, addOns };
                        })
                      }
                    />
                    <span>
                      {name}
                      <span className="block text-sm text-muted-foreground tabular-nums">
                        {formatKip(a.price, dict.common.kip)} {dict.booking.addOnUnits[a.unit]}
                      </span>
                    </span>
                  </Label>
                  {qty > 0 && a.unit !== "per_booking" && (
                    <QuantityStepper
                      value={qty}
                      min={1}
                      max={max}
                      onChange={(n) => update((d) => ({ ...d, addOns: { ...d.addOns, [a.id]: n } }))}
                      decreaseLabel={t(dict.booking.decrease, { name })}
                      increaseLabel={t(dict.booking.increase, { name })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2 md:max-w-2xl">
          {problem && quote.people > 0 && (
            <p role="status" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="tabular-nums">
              <span className="text-muted-foreground">{t(dict.booking.peopleTotal, { n: quote.people })} · </span>
              <span className="text-lg font-semibold">{formatKip(quote.total, dict.common.kip)}</span>
            </p>
            <Button
              size="lg"
              className="min-h-12 px-6 text-base"
              disabled={problem !== null}
              onClick={() => router.push(`/${lang}/book/details`)}
            >
              {dict.common.next}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
