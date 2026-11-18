"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatKip, t } from "@/lib/i18n/format";
import type { PolicyTier } from "@/lib/refunds/policy";

type Preview = {
  paid: number;
  method: "cash" | "bank_transfer" | null;
  tiers: PolicyTier[];
  hoursLeft: number;
  percent: number;
  tierHours: number | null;
  amount: number;
};

// ຂໍ້ຕົກລົງ 54: ລູກຄ້າຍົກເລີກເອງ ຕາມນະໂຍບາຍ · server ຄິດ % ຄືນຕອນກົດ — ຖ້າເລີຍຂັ້ນລະຫວ່າງນັ້ນ → 409 ບອກເກົ່າ → ໃໝ່
export function CancelBooking({ code, preview, visitLabel, dict }: { code: string; preview: Preview; visitLabel: string; dict: Dictionary }) {
  const router = useRouter();
  const c = dict.cancel;
  const kip = (n: number) => formatKip(n, dict.common.kip);
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [bank, setBank] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const paid = preview.paid > 0;
  const needBank = paid && preview.amount > 0 && preview.method === "bank_transfer";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/bookings/${code}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedAmount: preview.amount, ...(reason.trim() && { reason: reason.trim() }), ...(needBank && { bank }) }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok) {
        router.refresh();
        return;
      }
      if (body.error === "refund_changed") {
        setError(t(c.changed, { old: kip(Number(body.expectedAmount)), new: kip(Number(body.amount)), percent: Number(body.percent) }));
        setAgree(false);
        router.refresh();
      } else if (body.error === "verifying") setError(c.verifying);
      else if (body.error === "not_cancellable" || body.error === "gate_sale") setError(c.notCancellable);
      else if (body.error === "bank_required") setError(c.bankRequired);
      else if (body.error === "validation") setError(c.bankInvalid);
      else setError(c.error);
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="min-h-11 w-full text-base text-destructive" onClick={() => setOpen(true)}>
        {c.open}
      </Button>
    );
  }

  const tiers = [...preview.tiers].sort((a, b) => b.hoursBefore - a.hoursBefore);
  const submitLabel = !paid ? c.submitUnpaid : preview.amount > 0 ? t(c.submitRefund, { amount: kip(preview.amount) }) : c.submitNoRefund;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-destructive/30 p-4" aria-labelledby="cancel-title">
      <h2 id="cancel-title" className="text-lg font-semibold">
        {t(c.title, { code })}
      </h2>
      <p>{visitLabel}</p>
      {paid ? (
        <>
          <p className="text-muted-foreground">{preview.hoursLeft > 0 ? t(c.hoursLeft, { hours: Math.floor(preview.hoursLeft) }) : c.passed}</p>
          <section className="rounded-lg bg-muted p-3" aria-label={c.policy}>
            <p className="font-semibold">{c.policy}</p>
            <ul className="flex flex-col gap-0.5" data-testid="policy-tiers">
              {tiers.map((tier) => (
                <li key={tier.hoursBefore} className={tier.hoursBefore === preview.tierHours ? "font-semibold text-primary" : undefined}>
                  {t(c.tier, { hours: tier.hoursBefore, percent: tier.refundPercent })} {tier.hoursBefore === preview.tierHours && c.current}
                </li>
              ))}
              <li className={preview.tierHours === null ? "font-semibold text-primary" : undefined}>
                {c.tierNone} {preview.tierHours === null && c.current}
              </li>
            </ul>
          </section>
          <div data-testid="refund-amount">
            <p className="text-muted-foreground">{t(c.paid, { amount: kip(preview.paid) })}</p>
            <p className="text-xl font-bold">{preview.amount > 0 ? t(c.willRefund, { amount: kip(preview.amount), percent: preview.percent }) : c.noRefund}</p>
          </div>
        </>
      ) : (
        <p>{c.unpaid}</p>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{c.reason}</span>
        <Input className="min-h-11 text-base" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {needBank && (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-semibold">{c.bankTitle}</legend>
          <label className="flex flex-col gap-1">
            <span>{c.bankName}</span>
            <Input className="min-h-11 text-base" required maxLength={100} value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span>{c.accountNumber}</span>
            <Input
              className="min-h-11 text-base tabular-nums"
              required
              inputMode="numeric"
              autoComplete="off"
              maxLength={30}
              value={bank.accountNumber}
              onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/[^\d -]/g, "") })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>{c.accountName}</span>
            <Input className="min-h-11 text-base" required maxLength={150} value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} />
          </label>
          <p className="text-sm text-muted-foreground">{c.bankHint}</p>
        </fieldset>
      )}
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 accent-primary" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{c.understand}</span>
      </label>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-destructive">
          <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" variant="destructive" className="min-h-11 text-base" disabled={!agree || busy}>
          {busy && <Loader2 aria-hidden className="animate-spin" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" className="min-h-11 text-base" onClick={() => setOpen(false)}>
          {c.back}
        </Button>
      </div>
    </form>
  );
}
