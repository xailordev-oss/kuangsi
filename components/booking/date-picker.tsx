"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DayAvailability } from "@/lib/booking/availability";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatNumber, formatVisitDate, t } from "@/lib/i18n/format";
import { addDays, dayOfWeek, todayInVientiane } from "@/lib/time";
import { cn } from "@/lib/utils";

// ຜົນຂອງເດືອນໃດ ຜູກກັບ key — key ບໍ່ກົງກັບເດືອນປັດຈຸບັນ = ກຳລັງໂຫຼດ (ບໍ່ຕ້ອງ setState ໃນ effect)
type Result = { key: string; days: DayAvailability[] | null };

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// "ເຫຼືອໜ້ອຍ" ເປັນພຽງເຄື່ອງໝາຍໃນ UI (≤ 10% ຂອງ capacity) ບໍ່ແມ່ນກົດທຸລະກິດ
const isFewLeft = (d: DayAvailability) => !d.closed && d.left > 0 && d.left <= d.capacity * 0.1;

export function DatePickerWithAvailability({
  value,
  onChange,
  onDayInfo,
  maxAdvanceDays,
  lang,
  dict,
}: {
  value?: string;
  onChange: (date: string) => void;
  onDayInfo: (day: DayAvailability | null) => void;
  maxAdvanceDays: number;
  lang: Locale;
  dict: Dictionary;
}) {
  const today = todayInVientiane();
  const [month, setMonth] = useState((value ?? today).slice(0, 7));
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const firstMonth = today.slice(0, 7);
  const lastMonth = addDays(today, maxAdvanceDays).slice(0, 7);

  const key = `${month}#${attempt}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/availability?from=${month}-01&to=${lastDayOfMonth(month)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { days: DayAvailability[] }) => !cancelled && setResult({ key, days: data.days }))
      .catch(() => !cancelled && setResult({ key, days: null }));
    return () => {
      cancelled = true;
    };
  }, [month, key]);

  const loading = result?.key !== key;
  const failed = !loading && result?.days === null;
  const days = !loading ? (result?.days ?? null) : null;
  useEffect(() => {
    if (!days || !value) return;
    const info = days.find((d) => d.date === value);
    if (info) onDayInfo(info);
  }, [days, value, onDayInfo]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(INTL_LOCALE[lang], { weekday: "narrow", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))));
  }, [lang]);
  const monthLabel = new Intl.DateTimeFormat(INTL_LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

  function describe(d: DayAvailability): string {
    if (d.closedReason) return dict.booking.closedReasons[d.closedReason];
    if (d.left === 0) return dict.booking.soldOut;
    return t(dict.booking.spotsLeft, { n: formatNumber(d.left) });
  }

  const selected = days?.find((d) => d.date === value);

  return (
    <section aria-labelledby="date-heading" className="flex flex-col gap-2">
      <h2 id="date-heading" className="font-semibold">
        {dict.booking.selectDate}
      </h2>
      <div className="rounded-xl border p-2">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            className="size-11 p-0"
            aria-label={dict.booking.prevMonth}
            disabled={month <= firstMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <p className="font-semibold" aria-live="polite">
            {monthLabel}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="size-11 p-0"
            aria-label={dict.booking.nextMonth}
            disabled={month >= lastMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        <div className="grid grid-cols-7 text-center text-sm text-muted-foreground" aria-hidden>
          {weekdays.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>

        {failed ? (
          <div role="alert" className="flex flex-col items-center gap-2 py-6">
            <p>{dict.booking.availabilityError}</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setAttempt((n) => n + 1)}>
              {dict.common.retry}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1" aria-busy={loading}>
            {Array.from({ length: dayOfWeek(`${month}-01`) }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {(days ?? Array.from({ length: Number(lastDayOfMonth(month).slice(8)) }, () => null)).map((d, i) => {
              const dayNumber = i + 1;
              if (!d) return <span key={i} className="h-11 animate-pulse rounded-md bg-muted" />;
              const unavailable = d.closed || d.left === 0;
              const isSelected = d.date === value;
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={isSelected}
                  aria-label={`${formatVisitDate(d.date, lang)} — ${describe(d)}`}
                  onClick={() => {
                    onChange(d.date);
                    onDayInfo(d);
                  }}
                  className={cn(
                    "relative flex h-11 flex-col items-center justify-center rounded-md text-base tabular-nums",
                    isSelected && "bg-primary font-semibold text-primary-foreground",
                    !isSelected && !unavailable && "hover:bg-accent",
                    unavailable && "cursor-not-allowed text-muted-foreground/60",
                  )}
                >
                  {dayNumber}
                  {unavailable && d.date >= today && <X aria-hidden className="absolute bottom-0.5 size-3" />}
                  {isFewLeft(d) && <span aria-hidden className={cn("absolute bottom-1 size-1.5 rounded-full", isSelected ? "bg-primary-foreground" : "bg-warning")} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {selected && (
        <p className="text-sm" aria-live="polite">
          {t(dict.booking.selectedDate, { date: formatVisitDate(selected.date, lang) })} ·{" "}
          {isFewLeft(selected) ? <span className="font-semibold text-warning">{describe(selected)}</span> : describe(selected)}
        </p>
      )}
    </section>
  );
}
