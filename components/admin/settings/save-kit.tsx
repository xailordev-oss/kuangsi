"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import type { DayLoad, Impact, SettingChange } from "@/lib/admin/settings";
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
        router.replace("/staff/login?callbackUrl=/admin/settings");
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

function DayList({ days, row, d }: { days: DayLoad[]; row: string; d: SD }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {days.slice(0, LISTED).map((x) => (
        <li key={x.date}>{t(row, { date: fmtDate(x.date, d), bookings: x.bookings, people: n(x.people), capacity: n(x.capacity ?? 0) })}</li>
      ))}
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
                <DayList days={impact.closing} row={c.dayRow} d={d} />
              </>
            )}
            {impact.shortened.length > 0 && (
              <>
                <p>{t(c.hoursShortened, total(impact.shortened))}</p>
                <DayList days={impact.shortened} row={c.dayRow} d={d} />
              </>
            )}
            <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.hoursEffect}</p>
          </div>
        )}
        {impact?.kind === "holiday" && (
          <div className="flex flex-col gap-2">
            <p>{t(c.holidayBody, { date: fmtDate(impact.day.date, d), bookings: impact.day.bookings, people: n(impact.day.people) })}</p>
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
            <p className="text-lg font-semibold">{t(c.rateNext, { currency: impact.currency, rate: n(impact.next.rate), date: fmtDate(impact.next.date, d) })}</p>
            <p className="rounded-lg bg-warning-subtle p-3 text-sm">{c.rateEffect}</p>
          </div>
        )}
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
