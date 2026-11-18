"use client";

import { Ban, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/booking/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";

type D = StaffDictionary["refunds"];
export type QueueCard = {
  id: string;
  bookingCode: string;
  amountLabel: string;
  amountLine: string;
  cancelledLine: string;
  reason: string;
  customer: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  accountLast4: string | null;
  purged: boolean;
  stale: boolean;
};
export type VoidCard = { bookingCode: string; line: string; soldLine: string; amountLabel: string };

// ຂໍ້ຕົກລົງ 54/55/57 — ຄິວໂອນຄືນ (ບັນທຶກໄດ້ເທື່ອດຽວ) + ຍົກເລີກການຂາຍ POS ມື້ນີ້ (ເງິນສົດເຕັມ · ເຫດຜົນບັງຄັບ)
export function RefundDesk({ queue, totalLabel, voids, retentionDays, d }: { queue: QueueCard[]; totalLabel: string; voids: VoidCard[]; retentionDays: number; d: D }) {
  const router = useRouter();
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<QueueCard | null>(null);
  const [voiding, setVoiding] = useState<VoidCard | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(url: string, body: unknown, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 401) {
        router.replace("/staff/login?callbackUrl=/staff/refunds");
        return false;
      }
      if (!res.ok) {
        setError((d.errors as Record<string, string>)[String(json.error)] ?? d.errors.internal);
        return false;
      }
      setNotice(ok);
      router.refresh();
      return true;
    } catch {
      setError(d.errors.network);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-destructive">
          {error}
        </p>
      )}
      <p role="status" className={notice ? "font-semibold text-success" : "sr-only"}>
        {notice}
      </p>

      <section className="flex flex-col gap-3" aria-labelledby="queue-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="queue-title" className="text-lg font-semibold">
            {t(d.queue, { n: queue.length })}
          </h2>
          {queue.length > 0 && <span className="font-semibold tabular-nums">{totalLabel}</span>}
        </div>
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">{d.queueEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((q) => (
              <li key={q.id} data-testid={`refund-${q.bookingCode}`} className={`flex flex-col gap-2 rounded-lg border p-3 ${q.stale ? "border-warning/60 bg-warning-subtle" : "bg-card"}`}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums">{q.bookingCode}</span>
                  {q.stale && <span className="text-sm font-semibold text-warning">{t(d.stale, { days: retentionDays })}</span>}
                </span>
                <span className="text-sm text-muted-foreground">{q.cancelledLine}</span>
                <span className="text-lg font-bold">{q.amountLine}</span>
                <span className="text-sm">{t(d.reason, { reason: q.reason })}</span>
                {q.customer && <span className="text-sm">{q.customer}</span>}
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-sm text-muted-foreground">{d.account}</p>
                  {q.accountNumber ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="block">{q.bankName}</span>
                        <span className="block text-lg font-semibold tabular-nums">{q.accountNumber}</span>
                        <span className="block">{q.accountName}</span>
                      </span>
                      <CopyButton value={q.accountNumber} label={d.copy} copiedLabel={d.copied} />
                    </div>
                  ) : (
                    <p className="font-semibold text-warning">{q.purged ? t(d.accountPurged, { last4: q.accountLast4 ?? "????", days: retentionDays }) : d.noAccount}</p>
                  )}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold">{d.transferRef}</span>
                  <Input className="min-h-11 text-base" maxLength={100} value={refs[q.id] ?? ""} onChange={(e) => setRefs({ ...refs, [q.id]: e.target.value })} />
                </label>
                <Button type="button" className="min-h-11 w-fit" disabled={busy || !(refs[q.id] ?? "").trim()} onClick={() => setConfirming(q)}>
                  <CircleCheck aria-hidden />
                  {d.markDone}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="pos-title">
        <div>
          <h2 id="pos-title" className="text-lg font-semibold">
            {d.pos}
          </h2>
          <p className="text-sm text-muted-foreground">{d.posHint}</p>
        </div>
        {voids.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">{d.posEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {voids.map((v) => (
              <li key={v.bookingCode} data-testid={`void-${v.bookingCode}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
                <span className="flex flex-col">
                  <span className="font-semibold tabular-nums">{v.line}</span>
                  <span className="text-sm text-muted-foreground">{v.soldLine}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 text-destructive"
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setVoiding(v);
                  }}
                >
                  <Ban aria-hidden />
                  {d.void}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogTitle>{d.markDone}</DialogTitle>
          <DialogDescription className="text-base">{confirming && t(d.confirmDone, { amount: confirming.amountLabel, booking: confirming.bookingCode })}</DialogDescription>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(null)}>
              {d.cancel}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={async () => {
                const q = confirming!;
                setConfirming(null);
                await post(`/api/staff/refunds/${q.id}/complete`, { transferRef: (refs[q.id] ?? "").trim() }, d.done);
              }}
            >
              {d.markDone}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voiding !== null} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent>
          <DialogTitle>{voiding && t(d.voidTitle, { code: voiding.bookingCode })}</DialogTitle>
          <DialogDescription className="text-xl font-bold text-foreground">{voiding && t(d.voidCash, { amount: voiding.amountLabel })}</DialogDescription>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{d.voidReason}</span>
            <Input className="min-h-11 text-base" required minLength={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="void-hint" />
            <span id="void-hint" className="text-sm text-muted-foreground">
              {d.voidReasonHint}
            </span>
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setVoiding(null)}>
              {d.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                const v = voiding!;
                setVoiding(null);
                await post(`/api/staff/pos/bookings/${v.bookingCode}/void`, { reason: reason.trim() }, t(d.voided, { amount: v.amountLabel }));
              }}
            >
              {d.voidConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
