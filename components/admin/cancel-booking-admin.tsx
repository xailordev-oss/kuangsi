"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";

type D = StaffDictionary["admin"]["cancel"];
type Mode = "policy" | "full" | "custom";

// admin (booking.manage): ຕາມນະໂຍບາຍ / ເຕັມ / ກຳນົດເອງ ≤ ຍອດທີ່ຈ່າຍ · ເຫດຜົນບັງຄັບ (ຂໍ້ຕົກລົງ 54)
export function CancelBookingAdmin({
  code,
  paid,
  paidLabel,
  method,
  policyAmount,
  policyLine,
  fullLine,
  kipUnit,
  d,
  errors,
}: {
  code: string;
  paid: number;
  paidLabel: string | null;
  method: "cash" | "bank_transfer" | null;
  policyAmount: number;
  policyLine: string;
  fullLine: string;
  kipUnit: string;
  d: D;
  errors: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("policy");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [bank, setBank] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = (v: number) => `${new Intl.NumberFormat("en-US").format(v)} ${kipUnit}`;
  const hasBank = bank.bankName.trim() && bank.accountNumber.trim() && bank.accountName.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        mode: paid > 0 ? mode : "policy",
        reason: reason.trim(),
        ...(mode === "custom" && paid > 0 && { amount: Number(amount) }),
        ...(mode === "policy" && { expectedAmount: policyAmount }),
        ...(method === "bank_transfer" && hasBank && { bank }),
      };
      const res = await fetch(`/api/admin/bookings/${code}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      if (json.error === "refund_changed") {
        setError(t(d.changed, { old: n(Number(json.expectedAmount)), new: n(Number(json.amount)), percent: Number(json.percent) }));
        router.refresh();
      } else setError(errors[String(json.error)] ?? errors.internal);
    } catch {
      setError(errors.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11 w-fit text-destructive" onClick={() => setOpen(true)}>
        <Ban aria-hidden />
        {d.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{t(d.title, { code })}</DialogTitle>
          <DialogDescription className="text-base text-foreground">{paidLabel ?? d.unpaid}</DialogDescription>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            {paid > 0 && (
              <fieldset className="flex flex-col gap-2">
                {(
                  [
                    ["policy", policyLine],
                    ["full", fullLine],
                    ["custom", d.custom],
                  ] as [Mode, string][]
                ).map(([m, label]) => (
                  <label key={m} className="flex min-h-11 items-center gap-2">
                    <input type="radio" name="mode" className="size-5 accent-primary" checked={mode === m} onChange={() => setMode(m)} />
                    <span>{label}</span>
                  </label>
                ))}
                {mode === "custom" && (
                  <Input
                    className="min-h-11 text-base tabular-nums"
                    inputMode="numeric"
                    required
                    aria-label={d.custom}
                    placeholder={t(d.customHint, { max: n(paid) })}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                )}
                <p className="text-sm text-muted-foreground">{method === "cash" ? d.cashNow : d.transferLater}</p>
              </fieldset>
            )}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{d.reason}</span>
              <Input className="min-h-11 text-base" required minLength={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {paid > 0 && method === "bank_transfer" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="font-semibold">{d.bankTitle}</legend>
                {(["bankName", "accountNumber", "accountName"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-sm">{d[k]}</span>
                    <Input className="min-h-11 text-base" value={bank[k]} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} />
                  </label>
                ))}
              </fieldset>
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
                {errors.cancel}
              </Button>
              <Button type="submit" variant="destructive" className="min-h-11" disabled={busy || reason.trim().length < 3}>
                {d.confirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
