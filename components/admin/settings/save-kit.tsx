"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import type { ActiveBooking, CatalogImpact, DayLoad, Impact, SettingChange } from "@/lib/admin/settings";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";

export type SD = StaffDictionary["admin"]["settings"];
type ConfirmDetails = { changes?: SettingChange[]; impact?: Impact };
type Json = Record<string, unknown>;

const n = (v: number | string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(v));

// Intl ຂອງ browser ບໍ່ມີລາວ → ສ້າງຮູບແບບວັນທີເອງ "ຈັນ 24/11/2026"
export function fmtDate(iso: string, d: SD): string {
  const [y, m, day] = iso.split("-");
  return `${d.weekdays[new Date(`${iso}T00:00:00Z`).getUTCDay()]} ${day}/${m}/${y}`;
}

export function formatAmount(v: number | string): string {
  return n(v);
}

// ທຸກການບັນທຶກຜ່ານບ່ອນດຽວ: 409 confirm_required → ເປີດ Dialog ຜົນກະທົບ → ກົດຢືນຢັນ = ສົ່ງຄືນພ້ອມ confirm: true
export function useSettingsSave(d: SD) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [badFields, setBadFields] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ details: ConfirmDetails; retry: () => void } | null>(null);

  async function send(url: string, method: "PUT" | "POST" | "PATCH" | "DELETE", body?: Json, onDone?: (json: Json) => void): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    setBadFields(new Set());
    try {
      const res = await fetch(url, {
        method,
        ...(body && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      });
      const json = (await res.json().catch(() => ({}))) as Json;
      if (res.status === 401) {
        router.replace(`/staff/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }
      if (res.status === 409 && json.error === "confirm_required") {
        setPending({ details: json as ConfirmDetails, retry: () => void send(url, method, { ...body, confirm: true }, onDone) });
        return;
      }
      if (!res.ok) {
        const code = typeof json.error === "string" ? json.error : "internal";
        setError((d.errors as Record<string, string>)[code] ?? d.errors.internal);
        if (Array.isArray(json.issues)) setBadFields(new Set(json.issues.map((i: { path: string }) => i.path.split(".").pop() ?? "")));
        return;
      }
      setNotice(json.changed === 0 ? d.noChange : d.saved);
      onDone?.(json);
      router.refresh();
    } catch {
      setError(d.errors.network);
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, notice, badFields, pending, setPending, send };
}

export type SaveState = ReturnType<typeof useSettingsSave>;

export function SaveFeedback({ s, d }: { s: SaveState; d: SD }) {
  return (
    <>
      {s.error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-destructive">
          {s.error}
        </p>
      )}
      <p role="status" className={s.notice ? "font-semibold text-success" : "sr-only"}>
        {s.notice}
      </p>
      <ConfirmDialog s={s} d={d} />
    </>
  );
}

const LISTED = 10;

function DayList({ days, row, d, linked }: { days: DayLoad[]; row: string; d: SD; linked?: boolean }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {days.slice(0, LISTED).map((x) => {
        const text = t(row, { date: fmtDate(x.date, d), bookings: x.bookings, people: n(x.people), capacity: n(x.capacity ?? 0) });
        // ຂໍ້ຕົກລົງ 58: ກົດໄປລາຍການການຈອງຂອງວັນນັ້ນ (ເປີດ tab ໃໝ່ — ບໍ່ເສຍຟອມທີ່ກຳລັງແກ້)
        return (
          <li key={x.date}>
            {linked ? (
              <Link href={`/admin/bookings?from=${x.date}&to=${x.date}`} target="_blank" className="text-primary underline">
                {text}
              </Link>
            ) : (
              text
            )}
          </li>
        );
      })}
      {days.length > LISTED && <li className="text-muted-foreground">{t(d.confirm.more, { n: days.length - LISTED })}</li>}
    </ul>
  );
}

const total = (days: DayLoad[]) => ({
  days: days.length,
  bookings: days.reduce((a, x) => a + x.bookings, 0),
  people: n(days.reduce((a, x) => a + x.people, 0)),
});

function ConfirmDialog({ s, d }: { s: SaveState; d: SD }) {
  const c = d.confirm;
  const details = s.pending?.details;
  const impact = details?.impact;
  const changes = details?.changes ?? [];
  const isBank = changes.some((x) => x.key.startsWith("bank_") || x.key.startsWith("verify_time_note_"));
  const title = isBank
    ? c.bankTitle
    : impact?.kind === "capacity"
      ? c.capacityTitle
      : impact?.kind === "hours"
        ? c.hoursTitle
        : impact?.kind === "holiday"
          ? c.holidayTitle
          : impact?.kind === "rate"
            ? c.rateTitle
            : impact?.kind === "catalog"
              ? c.catalogTitle
              : c.title;

  return (
    <Dialog open={s.pending !== null} onOpenChange={(o) => !o && s.setPending(null)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{c.title}</DialogDescription>
        {changes.length > 0 && (
          <div className="flex flex-col gap-2">
            {isBank && <p className="rounded-lg border border-warning/50 bg-warning-subtle p-3 font-semibold text-warning">{d.bank.warning}</p>}
            <p className="font-semibold">{c.changes}</p>
            <ul className="flex flex-col gap-2" data-testid="confirm-changes">
              {changes.map((x) => (
                <li key={x.key} className="rounded-lg border p-2">
                  <p className="text-sm text-muted-foreground">{(d.fields as Record<string, string>)[x.key] ?? x.key}</p>
                  <p className="break-words">
                    <span className="text-sm text-muted-foreground">{c.old}: </span>
                    <span className="line-through decoration-destructive/60">{x.old || c.empty}</span>
                  </p>
                  <p className="break-words font-semibold">
                    <span className="text-sm font-normal text-muted-foreground">{c.new}: </span>
                    {x.new}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {changes.some((x) => x.key === "refund_policies") && <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.refundEffect}</p>}
        {impact?.kind === "capacity" && (
          <div className="flex flex-col gap-2">
            <p>{t(c.capacityBody, { days: impact.days.length })}</p>
            <DayList days={impact.days} row={c.capacityRow} d={d} />
            <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.capacityEffect}</p>
          </div>
        )}
        {impact?.kind === "hours" && (
          <div className="flex flex-col gap-2">
            {impact.closing.length > 0 && (
              <>
                <p>{t(c.hoursClosing, total(impact.closing))}</p>
                <DayList days={impact.closing} row={c.dayRow} d={d} linked />
              </>
            )}
            {impact.shortened.length > 0 && (
              <>
                <p>{t(c.hoursShortened, total(impact.shortened))}</p>
                <DayList days={impact.shortened} row={c.dayRow} d={d} linked />
              </>
            )}
            <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.hoursEffect}</p>
          </div>
        )}
        {impact?.kind === "holiday" && (
          <div className="flex flex-col gap-2">
            <p>{t(c.holidayBody, { date: fmtDate(impact.day.date, d), bookings: impact.day.bookings, people: n(impact.day.people) })}</p>
            <BookingLinks bookings={impact.bookings} d={d} />
            <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.hoursEffect}</p>
          </div>
        )}
        {impact?.kind === "rate" && (
          <div className="flex flex-col gap-2">
            <p>
              {impact.previous
                ? t(c.ratePrevious, { currency: impact.currency, rate: n(impact.previous.rate), date: fmtDate(impact.previous.date, d) })
                : c.rateNone}
            </p>
            {impact.replacing && (
              <p className="break-words">
                <span className="text-sm text-muted-foreground">{c.old}: </span>
                <span className="line-through decoration-destructive/60">{t(c.rateLine, { currency: impact.currency, rate: n(impact.replacing) })}</span>
              </p>
            )}
            <p className="text-lg font-semibold">{t(c.rateNext, { currency: impact.currency, rate: n(impact.next.rate), date: fmtDate(impact.next.date, d) })}</p>
            <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.rateEffect}</p>
          </div>
        )}
        {impact?.kind === "catalog" && <CatalogImpactView impact={impact} d={d} />}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => s.setPending(null)}>
            {d.cancel}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={s.busy}
            onClick={() => {
              const retry = s.pending?.retry;
              s.setPending(null);
              retry?.();
            }}
          >
            {d.confirmSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 10c: ລາຄາເກົ່າ → ໃໝ່ + ສ່ວນຕ່າງ · ການຈອງທີ່ຍັງຖືລາຄາເກົ່າ · ຜົນຂອງການປິດຂາຍ
function CatalogImpactView({ impact, d }: { impact: CatalogImpact; d: SD }) {
  const c = d.confirm;
  const kip = (v: string) => `${n(v)} ${d.kipUnit}`;
  const delta = impact.oldPrice === null ? 0 : Number(impact.newPrice) - Number(impact.oldPrice);
  const pct = impact.oldPrice && Number(impact.oldPrice) > 0 ? Math.round((delta / Number(impact.oldPrice)) * 100) : null;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return (
    <div className="flex flex-col gap-2" data-testid="catalog-impact">
      {impact.oldPrice === null ? (
        <p className="text-lg font-semibold">{t(c.catalogCreate, { name: impact.name, price: kip(impact.newPrice) })}</p>
      ) : (
        <>
          <p className="font-semibold">{impact.name}</p>
          {delta !== 0 && (
            <>
              <p>
                <span className="text-sm text-muted-foreground">{c.catalogOld}: </span>
                <span className="line-through decoration-destructive/60">{kip(impact.oldPrice)}</span>
              </p>
              <p className="text-lg font-semibold">
                <span className="text-sm font-normal text-muted-foreground">{c.catalogNew}: </span>
                {kip(impact.newPrice)}{" "}
                {pct !== null && <span className="text-base font-normal">{t(c.catalogDiff, { sign, amount: n(Math.abs(delta)), pct: Math.abs(pct) })}</span>}
              </p>
            </>
          )}
          {impact.deactivating && <p className="rounded-lg bg-warning-subtle p-3 text-sm">{t(c.catalogDeactivate, { name: impact.name })}</p>}
          {impact.lastPaidInGroup && (
            <p className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3 font-semibold text-destructive">
              {t(c.catalogLastPaid, { group: d.groupNames[impact.lastPaidInGroup] })}
            </p>
          )}
          <p className="text-sm">{t(c.catalogHolding, impact.holding)}</p>
        </>
      )}
      {!impact.deactivating && <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.catalogNewBookings}</p>}
    </div>
  );
}

// ຂໍ້ຕົກລົງ 58: ລາຍການການຈອງຂອງວັນທີ່ປິດ ພ້ອມລິ້ງໄປໜ້າຍົກເລີກແຕ່ລະອັນ (ຍົກເລີກທີລະອັນໃນ v1)
export function BookingLinks({ bookings, d }: { bookings: ActiveBooking[]; d: SD }) {
  if (bookings.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">{d.closedDayBookings}</p>
      <ul className="flex flex-wrap gap-2" data-testid="closed-day-bookings">
        {bookings.map((b) => (
          <li key={b.code}>
            <Link href={`/admin/bookings/${b.code}`} target="_blank" className="inline-flex min-h-11 items-center rounded-md border px-3 text-primary underline tabular-nums">
              {t(d.bookingLink, { code: b.code, people: b.people, status: (d.bookingStatus as Record<string, string>)[b.status] ?? b.status })}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
