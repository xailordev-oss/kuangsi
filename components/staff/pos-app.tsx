"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Minus, Plus, Printer, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneInput, toE164, type PhoneValue } from "@/components/booking/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PosWindow } from "@/lib/booking/availability";
import type { CountryNames } from "@/lib/country-names";
import { formatKip, formatNumber, t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";
import type { TicketLine } from "@/lib/scan/check-in";
import { cn } from "@/lib/utils";

export type PosTicket = {
  id: string;
  name: string;
  ages: string | null;
  visitorGroup: "lao" | "foreigner";
  ageGroup: TicketLine["ageGroup"];
  price: number;
};

type Group = PosTicket["visitorGroup"];
type Sale = {
  bookingCode: string;
  qrSvg: string;
  lines: TicketLine[];
  total: number;
  change: number;
  checkedIn: boolean;
};
type Failure = { kind: "uncertain" } | { kind: "message"; text: string };

const GROUP_KEY = "ks-pos-group";
const STATUS_EVERY_MS = 30_000;
const TIMEOUT_MS = 8_000;
const MAX_PER_LINE = 99;

function readGroup(): Group {
  try {
    return localStorage.getItem(GROUP_KEY) === "foreigner" ? "foreigner" : "lao";
  } catch {
    return "lao";
  }
}

// ປຸ່ມລັດເງິນທີ່ຮັບ: ພໍດີ + ປັດຂຶ້ນເປັນໃບເງິນທີ່ໃຊ້ທົ່ວໄປ
function quickAmounts(total: number): number[] {
  const up = (step: number) => Math.ceil(total / step) * step;
  const candidates = [up(10_000), up(50_000), up(100_000), up(100_000) + 100_000];
  return [...new Set(candidates)].filter((n) => n > total).slice(0, 3);
}

// ຂໍ້ຕົກລົງ 41: online ເທົ່ານັ້ນ · ກົດຊ້ຳ/ເນັດຂາດກາງທາງ → ສົ່ງ requestId ເດີມ server ຄືນຜົນເດີມ
export function PosApp({
  tickets,
  initialWindow,
  countryNames,
  dict,
}: {
  tickets: PosTicket[];
  initialWindow: PosWindow;
  countryNames: CountryNames;
  dict: StaffDictionary;
}) {
  const p = dict.pos;
  const router = useRouter();
  const kip = useCallback((n: number) => formatKip(n, dict.common.kip), [dict.common.kip]);

  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState(initialWindow);
  const [group, setGroup] = useState<Group>("lao");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"pick" | "cash" | "done">("pick");
  const [received, setReceived] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<PhoneValue>({ country: "LA", national: "" });
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);

  // ອ່ານຄ່າທີ່ຈື່ໄວ້ຫຼັງ mount (localStorage ບໍ່ມີຢູ່ server — ກັນ hydration ບໍ່ກົງ)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setGroup(readGroup());
    setOnline(navigator.onLine);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/pos/status", { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 401) {
        router.replace("/staff/login?callbackUrl=/staff/pos");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setStatus((await res.json()) as PosWindow);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [router]);

  useEffect(() => {
    const goOffline = () => setOnline(false);
    const goOnline = () => void refreshStatus();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = setInterval(() => void refreshStatus(), STATUS_EVERY_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshStatus]);

  const lines = useMemo(() => tickets.filter((tt) => (cart[tt.id] ?? 0) > 0), [tickets, cart]);
  const people = lines.reduce((n, tt) => n + cart[tt.id], 0);
  const total = lines.reduce((n, tt) => n + cart[tt.id] * tt.price, 0);
  const cash = received === "" ? NaN : Number(received);
  const short = Number.isFinite(cash) ? total - cash : total;
  const closed = status.state === "closed";
  const tooMany = people > status.left;
  const locked = failure?.kind === "uncertain"; // ຫ້າມແກ້ການຂາຍທີ່ອາດບັນທຶກແລ້ວ

  function pickGroup(g: Group) {
    setGroup(g);
    try {
      localStorage.setItem(GROUP_KEY, g);
    } catch {}
  }

  function setQty(id: string, n: number) {
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(MAX_PER_LINE, n)) }));
  }

  function reset() {
    setCart({});
    setReceived("");
    setName("");
    setPhone({ country: "LA", national: "" });
    setShowCustomer(false);
    setRequestId(null);
    setFailure(null);
    setSale(null);
    setStep("pick");
    void refreshStatus();
  }

  function errorText(body: Record<string, unknown>): string {
    switch (body.error) {
      case "date_closed":
        return body.reason === "before_hours" ? t(p.beforeHours, { time: status.graceFrom?.slice(0, 5) ?? "" }) : p.dateClosed;
      case "sold_out":
        return t(p.soldOut, { n: Number(body.left ?? 0) });
      case "customer_name_required":
        return p.nameRequired;
      case "insufficient_cash":
        return t(p.short, { amount: kip(Number(body.short ?? 0)) });
      case "validation":
        return p.phoneInvalid;
      default:
        return p.error;
    }
  }

  async function submit() {
    if (busy || !online) return;
    const fullName = name.trim();
    const national = phone.national.trim();
    const e164 = national ? toE164(phone) : null;
    if (national && !e164) {
      setFailure({ kind: "message", text: p.phoneInvalid });
      return;
    }
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/staff/pos/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
        body: JSON.stringify({
          requestId: id,
          items: lines.map((tt) => ({ ticketTypeId: tt.id, quantity: cart[tt.id] })),
          addOns: [],
          cashReceived: cash,
          ...((fullName || e164) && {
            customer: { ...(fullName && { fullName }), ...(e164 && { phone: e164 }) },
          }),
        }),
      });
      if (res.status === 401) {
        setFailure({ kind: "message", text: p.sessionEnded });
        router.replace("/staff/login?callbackUrl=/staff/pos");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok) {
        const booking = body.booking as { bookingCode: string; total: string };
        setSale({
          bookingCode: booking.bookingCode,
          qrSvg: String(body.qrSvg ?? ""),
          lines: body.lines as TicketLine[],
          total: Number(booking.total),
          change: Number(body.change),
          checkedIn: Boolean(body.checkedIn),
        });
        setStep("done");
        return;
      }
      if (res.status >= 500) {
        setFailure({ kind: "uncertain" });
        return;
      }
      // 4xx: server ປະຕິເສດກ່ອນບັນທຶກ → ແກ້ແລ້ວສົ່ງໃໝ່ເປັນການຂາຍໃໝ່ໄດ້
      setRequestId(null);
      setFailure({ kind: "message", text: errorText(body) });
      if (body.error === "date_closed" || body.error === "sold_out") void refreshStatus();
    } catch {
      // timeout / ເນັດຂາດກາງທາງ: ບໍ່ຮູ້ວ່າ server ບັນທຶກແລ້ວບໍ່ → ສົ່ງ requestId ເດີມຊ້ຳເທົ່ານັ້ນ
      setFailure({ kind: "uncertain" });
      void refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  const visible = tickets.filter((tt) => tt.visitorGroup === group);
  const groupCount = (g: Group) => tickets.filter((tt) => tt.visitorGroup === g).reduce((n, tt) => n + (cart[tt.id] ?? 0), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="space-y-2 px-4 pt-3 print:hidden" aria-live="polite">
        {!online && (
          <div role="alert" className="flex items-start gap-3 rounded-lg bg-destructive p-4 text-white">
            <WifiOff aria-hidden className="mt-1 size-6 shrink-0" />
            <div>
              <p className="text-lg font-bold">{p.offline}</p>
              <p className="text-sm">{p.offlineHint}</p>
            </div>
          </div>
        )}
        {online && status.state === "grace" && status.openTime && status.closeTime && (
          <div role="status" className="flex items-start gap-3 rounded-lg bg-scan-warn p-3 text-foreground">
            <AlertTriangle aria-hidden className="mt-1 size-5 shrink-0" />
            <p className="font-semibold">{t(p.graceBanner, { open: status.openTime.slice(0, 5), close: status.closeTime.slice(0, 5) })}</p>
          </div>
        )}
        {online && closed && (
          <div role="alert" className="rounded-lg bg-destructive-subtle p-3 font-semibold text-destructive">
            {status.closedReason === "before_hours" && status.graceFrom ? t(p.beforeHours, { time: status.graceFrom.slice(0, 5) }) : p.dateClosed}
          </div>
        )}
      </div>

      {step === "pick" && (
        <>
          {/* ກຸ່ມ + ລາຍການປີ້ ຢູ່ເຄິ່ງລຸ່ມ ປຸ່ມ +/− ໃຫຍ່ (ມືດຽວ) */}
          <div className="mt-auto px-4 pt-3">
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {(["lao", "foreigner"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={group === g}
                  onClick={() => pickGroup(g)}
                  className={cn(
                    "min-h-14 rounded-lg border-2 px-3 text-lg font-semibold",
                    group === g ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                  )}
                >
                  {g === "lao" ? p.groupLao : p.groupForeigner}
                  {groupCount(g) > 0 && <span className="ms-2 tabular-nums">({groupCount(g)})</span>}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2 px-4 pt-3">
            {visible.map((tt) => {
              const n = cart[tt.id] ?? 0;
              return (
                <li key={tt.id} className="flex items-center gap-2 rounded-lg border bg-card p-2 ps-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{tt.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tt.price === 0 ? p.free : kip(tt.price)}
                      {tt.ages && ` · ${tt.ages}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="size-14 rounded-full p-0"
                    aria-label={t(p.remove, { name: tt.name })}
                    disabled={n === 0}
                    onClick={() => setQty(tt.id, n - 1)}
                  >
                    <Minus aria-hidden className="size-6" />
                  </Button>
                  <output aria-live="polite" className="w-10 text-center text-2xl font-bold tabular-nums">
                    {n}
                  </output>
                  <Button
                    type="button"
                    className="size-14 rounded-full p-0"
                    aria-label={t(p.add, { name: tt.name })}
                    disabled={n >= MAX_PER_LINE}
                    onClick={() => setQty(tt.id, n + 1)}
                  >
                    <Plus aria-hidden className="size-6" />
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-0 mt-4 border-t bg-background px-4 pb-4 pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">
                {t(p.people, { n: people })}
                {online && !closed && ` · ${t(p.left, { n: formatNumber(status.left) })}`}
              </span>
              <span className="text-2xl font-bold tabular-nums" data-testid="pos-total">
                {kip(total)}
              </span>
            </div>
            {tooMany && people > 0 && <p className="mb-2 text-destructive">{t(p.soldOut, { n: status.left })}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-16 px-5 text-lg" disabled={people === 0} onClick={() => setCart({})}>
                {p.clear}
              </Button>
              <Button
                type="button"
                className="h-16 flex-1 text-xl"
                disabled={people === 0 || !online || closed || tooMany}
                onClick={() => {
                  setFailure(null);
                  setStep("cash");
                }}
              >
                {p.takeCash}
              </Button>
            </div>
          </div>
        </>
      )}

      {step === "cash" && (
        <div className="flex flex-1 flex-col px-4 pt-3">
          <h2 className="text-xl font-bold">{p.cashTitle}</h2>
          <ul className="mt-1 text-muted-foreground">
            {lines.map((tt) => (
              <li key={tt.id}>
                {tt.name} × {cart[tt.id]}
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <button
              type="button"
              aria-expanded={showCustomer}
              disabled={locked}
              onClick={() => setShowCustomer((v) => !v)}
              className="flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              <ChevronDown aria-hidden className={cn("size-4 transition-transform", showCustomer && "rotate-180")} />
              {p.addCustomer}
            </button>
            {showCustomer && (
              <div className="mt-2 space-y-3 rounded-lg border p-3">
                <div className="space-y-1">
                  <Label htmlFor="pos-name">{p.customerName}</Label>
                  <Input id="pos-name" value={name} disabled={locked} autoComplete="off" onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pos-phone">{p.customerPhone}</Label>
                  <PhoneInput
                    id="pos-phone"
                    value={phone}
                    onChange={setPhone}
                    names={countryNames}
                    countryLabel={p.phoneCountry}
                    otherLabel={p.phoneOther}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ເງິນ ແລະ ປຸ່ມຢູ່ເຄິ່ງລຸ່ມ */}
          <div className="mt-auto space-y-3 border-t bg-background pb-4 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-lg">{p.total}</span>
              <span className="text-3xl font-bold tabular-nums">{kip(total)}</span>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pos-cash" className="text-base">
                {p.received}
              </Label>
              <Input
                id="pos-cash"
                inputMode="numeric"
                autoComplete="off"
                className="h-14 text-right text-2xl tabular-nums"
                value={received === "" ? "" : formatNumber(Number(received))}
                disabled={locked}
                onChange={(e) => setReceived(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Button type="button" variant="secondary" className="h-12 text-base" disabled={locked} onClick={() => setReceived(String(total))}>
                {p.exact}
              </Button>
              {quickAmounts(total).map((n) => (
                <Button key={n} type="button" variant="secondary" className="h-12 px-1 text-base tabular-nums" disabled={locked} onClick={() => setReceived(String(n))}>
                  {formatNumber(n)}
                </Button>
              ))}
            </div>
            {Number.isFinite(cash) &&
              (short > 0 ? (
                <p className="text-lg font-semibold text-destructive">{t(p.short, { amount: kip(short) })}</p>
              ) : (
                <div className="flex items-baseline justify-between rounded-lg bg-success-subtle p-3">
                  <span className="text-lg">{p.change}</span>
                  <span className="text-3xl font-bold tabular-nums text-success" data-testid="pos-change">
                    {kip(-short)}
                  </span>
                </div>
              ))}

            {failure && (
              <p role="alert" className="font-semibold text-destructive">
                {failure.kind === "uncertain" ? p.uncertain : failure.text}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-16 px-5 text-lg"
                disabled={busy || locked}
                onClick={() => {
                  setFailure(null);
                  setStep("pick");
                }}
              >
                {p.back}
              </Button>
              <Button
                type="button"
                className="h-16 flex-1 text-lg"
                disabled={busy || !online || !Number.isFinite(cash) || short > 0 || (closed && !locked)}
                onClick={() => void submit()}
              >
                {busy ? p.selling : locked ? p.retrySame : t(p.confirm, { total: kip(total) })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && sale && (
        <div className="flex flex-1 flex-col px-4 pt-3">
          <section aria-labelledby="pos-sold" className="space-y-3 pb-4 text-center">
            <p id="pos-sold" className="flex items-center justify-center gap-2 text-2xl font-bold text-success print:hidden">
              <CheckCircle2 aria-hidden className="size-7" />
              {p.sold}
            </p>
            <div className="flex items-baseline justify-between rounded-lg bg-success-subtle p-3 print:hidden">
              <span className="text-lg">{p.change}</span>
              <span className="text-4xl font-bold tabular-nums text-success" data-testid="pos-change">
                {kip(sale.change)}
              </span>
            </div>
            <div
              role="img"
              aria-label={t(p.qrAlt, { code: sale.bookingCode })}
              className="mx-auto w-64 max-w-full [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: sale.qrSvg }}
            />
            <p className="text-center font-mono text-3xl font-bold tracking-wider" data-testid="pos-code">
              {sale.bookingCode}
            </p>
            <ul className="text-lg [&>li]:text-center">
              {sale.lines.map((l) => (
                <li key={`${l.visitorGroup}:${l.ageGroup}`}>
                  {l.visitorGroup === "lao" ? p.groupLao : p.groupForeigner} {dict.scan.age[l.ageGroup]} × {l.quantity}
                </li>
              ))}
            </ul>
            <p className="text-center text-lg">
              {p.total}: <span className="font-semibold tabular-nums">{kip(sale.total)}</span>
            </p>
            <p className={cn("rounded-lg p-2 text-center font-semibold", sale.checkedIn ? "bg-success-subtle text-success" : "bg-muted")}>
              {sale.checkedIn ? p.checkedIn : p.scanAtGate}
            </p>
            <p className="text-center text-sm text-muted-foreground print:hidden">{p.receiptHint}</p>
          </section>

          <div className="mt-auto flex gap-2 border-t bg-background pb-4 pt-3 print:hidden">
            {/* ຂໍ້ຕົກລົງ 42: ພິມຜ່ານ browser — TODO: ຢືນຢັນເຄື່ອງພິມກັບຜູ້ຈັດການຕາດ */}
            <Button type="button" variant="outline" className="h-16 px-5 text-lg" onClick={() => window.print()}>
              <Printer aria-hidden className="size-5" />
              {p.print}
            </Button>
            <Button type="button" className="h-16 flex-1 text-xl" onClick={reset}>
              {p.newSale}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

