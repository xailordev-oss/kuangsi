"use client";

import { Check, ExternalLink, Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";

export type ProofCard = {
  paymentId: string;
  bookingCode: string;
  visitDateLabel: string;
  totalLabel: string;
  customerName: string | null;
  customerPhone: string | null;
  waitedLabel: string;
};

const REASON_MAX = 255;

type Notice = { kind: "ok" | "error"; text: string };

export function ProofQueue({ items, dict }: { items: ProofCard[]; dict: StaffDictionary }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const visible = items.filter((i) => !done.has(i.paymentId));

  function finish(item: ProofCard, n: Notice) {
    setDone((d) => new Set(d).add(item.paymentId));
    setNotice(n);
  }

  async function act(item: ProofCard, action: "approve" | "reject", body: object) {
    try {
      const res = await fetch(`/api/staff/proofs/${item.paymentId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        finish(item, { kind: "ok", text: t(action === "approve" ? dict.proofs.approved : dict.proofs.rejected, { code: item.bookingCode }) });
        return true;
      }
      if (data.error === "already_verified") {
        finish(item, { kind: "error", text: t(dict.proofs.alreadyDone, { name: data.verifiedBy ?? "—" }) });
      } else if (data.error === "not_verifying" || data.error === "not_found") {
        finish(item, { kind: "error", text: dict.proofs.notVerifying });
      } else {
        setNotice({ kind: "error", text: dict.common.error });
      }
    } catch {
      setNotice({ kind: "error", text: dict.common.network });
    }
    return false;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t(dict.proofs.title, { n: visible.length })}</h1>
        <Button variant="outline" className="min-h-11 text-base" onClick={() => router.refresh()}>
          <RotateCcw aria-hidden />
          {dict.proofs.refresh}
        </Button>
      </div>
      {notice && (
        <p role="status" className={notice.kind === "ok" ? "rounded-md bg-success-subtle p-3 text-success" : "rounded-md bg-destructive-subtle p-3 text-destructive"}>
          {notice.text}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{dict.proofs.empty}</p>
      ) : (
        visible.map((item) => <ReviewCard key={item.paymentId} item={item} dict={dict} act={act} />)
      )}
    </div>
  );
}

function ReviewCard({
  item,
  dict,
  act,
}: {
  item: ProofCard;
  dict: StaffDictionary;
  act: (item: ProofCard, action: "approve" | "reject", body: object) => Promise<boolean>;
}) {
  const [transactionId, setTransactionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = `/api/staff/proofs/${item.paymentId}/image`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border p-4" aria-label={item.bookingCode}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-bold tabular-nums">{item.bookingCode}</p>
        <p className="text-sm text-muted-foreground">{item.waitedLabel}</p>
      </div>
      <p className="text-lg font-semibold">{t(dict.proofs.expected, { amount: item.totalLabel })}</p>

      {imageFailed ? (
        <p className="rounded-md bg-muted p-6 text-center text-muted-foreground">{dict.proofs.imageError}</p>
      ) : (
        <a href={imageUrl} target="_blank" rel="noopener" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- ຮູບສ່ວນຕົວຜ່ານ API ທີ່ກວດສິດ */}
          <img
            src={imageUrl}
            alt={t(dict.proofs.imageAlt, { code: item.bookingCode })}
            onError={() => setImageFailed(true)}
            className="max-h-[28rem] w-full rounded-lg border bg-muted object-contain"
          />
          <span className="mt-1 flex items-center gap-1 text-sm text-primary">
            <ExternalLink aria-hidden className="size-4" />
            {dict.proofs.openFull}
          </span>
        </a>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3">
        <dt className="text-muted-foreground">{dict.proofs.bookedBy}</dt>
        <dd>
          {item.customerName ?? "—"} {item.customerPhone && <span className="tabular-nums text-muted-foreground">· {item.customerPhone}</span>}
        </dd>
        <dt className="text-muted-foreground">{dict.proofs.visitDate}</dt>
        <dd>{item.visitDateLabel}</dd>
      </dl>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`txn-${item.paymentId}`} className="text-base">
          {dict.proofs.transactionId}
        </Label>
        <Input
          id={`txn-${item.paymentId}`}
          value={transactionId}
          maxLength={100}
          onChange={(e) => setTransactionId(e.target.value)}
          className="min-h-11 text-base"
          aria-describedby={`txn-hint-${item.paymentId}`}
        />
        <p id={`txn-hint-${item.paymentId}`} className="text-sm text-muted-foreground">
          {dict.proofs.transactionIdHint}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-h-12 text-base text-destructive" disabled={busy} onClick={() => setRejectOpen(true)}>
          <X aria-hidden />
          {dict.proofs.reject}
        </Button>
        <Button
          className="min-h-12 text-base"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (!(await act(item, "approve", { transactionId }))) setBusy(false);
          }}
        >
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
          {dict.proofs.approve}
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogTitle className="text-lg">{dict.proofs.rejectTitle}</DialogTitle>
          <DialogDescription className="text-base">{dict.proofs.rejectHint}</DialogDescription>
          <div className="flex flex-wrap gap-2">
            {[dict.proofs.reasonAmount, dict.proofs.reasonUnclear, dict.proofs.reasonNotFound].map((r) => (
              <Button key={r} type="button" variant="outline" className="min-h-11 text-base" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <textarea
            aria-label={dict.proofs.rejectTitle}
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background p-3 text-base"
          />
          <p className="text-sm text-muted-foreground">
            {reason.trim() ? t(dict.proofs.charsLeft, { n: REASON_MAX - reason.length }) : dict.proofs.reasonRequired}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11 text-base" onClick={() => setRejectOpen(false)}>
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 text-base"
              disabled={!reason.trim() || busy}
              onClick={async () => {
                setBusy(true);
                const ok = await act(item, "reject", { reason: reason.trim() });
                if (!ok) setBusy(false);
                setRejectOpen(false);
              }}
            >
              {dict.proofs.confirmReject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
