"use client";

import { Ban, Camera, CheckCircle2, CircleAlert, CloudOff, Keyboard, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";
import type { ScanResult, TicketLine } from "@/lib/scan/check-in";
import { decideOffline, needsReview, shouldQueue, type Manifest, type OfflineResult, type QueuedScan, type TicketRef } from "@/lib/scan/offline";
import { todayInVientiane } from "@/lib/time";
import { cn } from "@/lib/utils";

type Kind = ScanResult | "offline_ok" | "offline_unknown";
type Display = {
  kind: Kind;
  bookingCode: string | null;
  lines: TicketLine[];
  previous: { scannedAt: string; gate: string } | null;
  visitDate: string | null;
};
type Conflict = { offlineId: string; bookingCode: string | null; result: string; scannedAt: string };

const KEYS = { manifest: "ks-scan-manifest", queue: "ks-scan-queue", conflicts: "ks-scan-conflicts", gate: "ks-scan-gate" };
const CODE_RE = /^KS-[23456789A-HJ-NP-Z]{5}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 4000;
const MANIFEST_REFRESH_MS = 60_000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage ເຕັມ ຫຼື ຖືກປິດ
  }
}

// ຂໍ້ຈຳກັດ ui-brief 4: ມືດຽວ · ກາງແດດ · ເນັດຂາດ · ເຫັນຜົນຈາກໄກ
const STYLE: Record<Kind, { bg: string; icon: typeof CheckCircle2; autoMs: number | null }> = {
  ok: { bg: "bg-success text-white", icon: CheckCircle2, autoMs: 2000 },
  offline_ok: { bg: "bg-offline text-white", icon: CloudOff, autoMs: 3000 },
  wrong_date: { bg: "bg-scan-warn text-foreground", icon: CircleAlert, autoMs: null },
  offline_unknown: { bg: "bg-scan-warn text-foreground", icon: CloudOff, autoMs: null },
  duplicate: { bg: "bg-destructive text-white", icon: Ban, autoMs: null },
  expired: { bg: "bg-destructive text-white", icon: Ban, autoMs: null },
  invalid: { bg: "bg-destructive text-white", icon: Ban, autoMs: null },
  unpaid: { bg: "bg-destructive text-white", icon: Ban, autoMs: null },
  cancelled: { bg: "bg-destructive text-white", icon: Ban, autoMs: null },
};

// ສຽງ + ສັ່ນ (iPhone ບໍ່ຮອງຮັບ vibrate — ສຽງຍັງເຮັດວຽກ)
function feedback(kind: Kind, audio: React.RefObject<AudioContext | null>) {
  const good = kind === "ok" || kind === "offline_ok";
  try {
    navigator.vibrate?.(good ? 120 : [250, 120, 250]);
  } catch {
    // ບໍ່ຮອງຮັບ
  }
  try {
    audio.current ??= new AudioContext();
    const ctx = audio.current;
    const beeps = good ? [[880, 0]] : [[220, 0], [220, 0.28]];
    for (const [freq, at] of beeps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.25;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.2);
    }
  } catch {
    // ບໍ່ມີສຽງ — ສີເຕັມຈໍຍັງເຫັນ
  }
}

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Vientiane" }).format(new Date(iso));
const dmy = (iso: string) => iso.split("-").reverse().join("/");

export function ScannerApp({ gates, dict }: { gates: string[]; dict: StaffDictionary }) {
  const router = useRouter();
  const s = dict.scan;
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number } | null>(null);

  const [gate, setGate] = useState<string | null>(gates.length === 1 ? gates[0] : null);
  const [online, setOnline] = useState(true);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [display, setDisplay] = useState<Display | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraState, setCameraState] = useState<"starting" | "on" | "denied">("starting");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [syncFailed, setSyncFailed] = useState(false);

  // ອ່ານສະຖານະທີ່ເກັບໄວ້ໃນເຄື່ອງ (ຫຼັງ hydrate)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage ອ່ານໄດ້ຫຼັງ hydrate ເທົ່ານັ້ນ */
    setManifest(load<Manifest | null>(KEYS.manifest, null));
    setQueue(load<QueuedScan[]>(KEYS.queue, []));
    setConflicts(load<Conflict[]>(KEYS.conflicts, []));
    setOnline(navigator.onLine);
    if (gates.length > 1) {
      const stored = load<string | null>(KEYS.gate, null);
      if (stored && gates.includes(stored)) setGate(stored);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [gates]);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(path, { ...init, signal: ctrl.signal, headers: { "Content-Type": "application/json" } });
        if (res.status === 401) {
          router.replace("/staff/login?callbackUrl=/staff/scan");
          throw new Error("unauthenticated");
        }
        setOnline(true);
        return res;
      } catch (error) {
        if ((error as Error).message !== "unauthenticated") setOnline(false);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    [router],
  );

  // ລາຍການປີ້ຂອງມື້ນີ້ ສຳລັບກວດຕອນ offline — ອັບເດດທຸກ 1 ນາທີ ເມື່ອມີເນັດ
  useEffect(() => {
    let stop = false;
    const refresh = async () => {
      try {
        const res = await api("/api/staff/scan/manifest");
        if (!res.ok || stop) return;
        const m = (await res.json()) as Manifest;
        setManifest(m);
        save(KEYS.manifest, m);
      } catch {
        // ອອບລາຍ — ໃຊ້ລາຍການເກົ່າ
      }
    };
    refresh();
    const id = setInterval(refresh, MANIFEST_REFRESH_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [api]);

  // ສົ່ງການສະແກນ offline ເມື່ອເນັດມາ · ຜົນທີ່ບໍ່ກົງ → ລາຍການ "ຕ້ອງກວດ" (ຫ້າມປະຖິ້ມງຽບໆ)
  useEffect(() => {
    if (!online || queue.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const items = queue.map(({ offlineId, qrToken, bookingCode, gate: g, scannedAt }) => ({
          offlineId,
          gate: g,
          scannedAt,
          ...(qrToken ? { qrToken } : { bookingCode }),
        }));
        const res = await api("/api/staff/scan/sync", { method: "POST", body: JSON.stringify({ items }) });
        if (!res.ok) throw new Error(String(res.status));
        const { results } = (await res.json()) as { results: { offlineId: string; result: string; bookingCode: string | null }[] };
        if (cancelled) return;
        const byId = new Map(queue.map((q) => [q.offlineId, q]));
        const fresh: Conflict[] = results
          .filter((r) => {
            const local = byId.get(r.offlineId);
            return local && needsReview(local.localResult, r.result);
          })
          .map((r) => ({ offlineId: r.offlineId, bookingCode: r.bookingCode, result: r.result, scannedAt: byId.get(r.offlineId)!.scannedAt }));
        const synced = new Set(results.map((r) => r.offlineId));
        setQueue((prev) => {
          const next = prev.filter((q) => !synced.has(q.offlineId));
          save(KEYS.queue, next);
          return next;
        });
        if (fresh.length) {
          setConflicts((prev) => {
            const next = [...prev, ...fresh];
            save(KEYS.conflicts, next);
            return next;
          });
        }
        setSyncFailed(false);
      } catch {
        if (!cancelled) setSyncFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, queue, api]);

  const show = useCallback(
    (d: Display) => {
      setDisplay(d);
      feedback(d.kind, audioRef);
      const auto = STYLE[d.kind].autoMs;
      setCountdown(auto ? Math.ceil(auto / 1000) : null);
    },
    [],
  );

  const handle = useCallback(
    async (ref: TicketRef) => {
      if (!gate || busyRef.current) return;
      busyRef.current = true;
      try {
        try {
          const res = await api("/api/staff/scan", { method: "POST", body: JSON.stringify({ gate, ...ref }) });
          if (res.ok) {
            const r = await res.json();
            show({ kind: r.result, bookingCode: r.bookingCode, lines: r.lines, previous: r.previous, visitDate: r.visitDate });
            return;
          }
          if (res.status === 400) {
            show({ kind: "invalid", bookingCode: null, lines: [], previous: null, visitDate: null });
            return;
          }
          throw new Error(String(res.status));
        } catch (error) {
          if ((error as Error).message === "unauthenticated") return;
        }
        // ອອບລາຍ: ກວດກັບລາຍການໃນເຄື່ອງ (ຂໍ້ຕົກລົງ 39)
        const { result, ticket } = decideOffline(manifest, todayInVientiane(), ref, queue);
        if (shouldQueue(result)) {
          const item: QueuedScan = {
            offlineId: crypto.randomUUID(),
            gate,
            scannedAt: new Date().toISOString(),
            localResult: result as OfflineResult,
            ...(ref.qrToken ? { qrToken: ref.qrToken } : {}),
            bookingCode: ticket?.bookingCode ?? ref.bookingCode,
          };
          setQueue((prev) => {
            const next = [...prev, item];
            save(KEYS.queue, next);
            return next;
          });
        }
        show({ kind: result, bookingCode: ticket?.bookingCode ?? ref.bookingCode ?? null, lines: ticket?.lines ?? [], previous: null, visitDate: null });
      } finally {
        busyRef.current = false;
      }
    },
    [gate, api, manifest, queue, show],
  );

  // ກ້ອງເປີດຄ້າງໄວ້ — ໃຊ້ ref ເພື່ອບໍ່ໃຫ້ກ້ອງ restart ທຸກຄັ້ງທີ່ລາຍການປີ້/ຄິວ ປ່ຽນ
  const handleRef = useRef(handle);
  const showRef = useRef(show);
  useEffect(() => {
    handleRef.current = handle;
    showRef.current = show;
  }, [handle, show]);

  // ກ້ອງ: ໂຫຼດ qr/dom ສະເພາະໜ້ານີ້ · ອ່ານ QR ດ້ວຍ JS (Safari) ຫຼື BarcodeDetector ຂອງ browser ຖ້າມີ
  useEffect(() => {
    if (!gate) return;
    let stopLoop: (() => void) | undefined;
    let camera: { stop: () => void } | undefined;
    let disposed = false;
    (async () => {
      try {
        const { QRCanvas, frameLoop, rearCamera } = await import("qr/dom.js");
        const video = videoRef.current;
        if (!video || disposed) return;
        const cam = await rearCamera(video);
        camera = cam;
        if (disposed) return cam.stop();
        setCameraState("on");
        const canvas = new QRCanvas();
        const tick = async () => {
          if (busyRef.current) return;
          const res = await cam.readFrame(canvas).catch(() => undefined);
          const text = typeof res === "string" ? res.trim() : undefined;
          if (!text) return;
          // ກັນອ່ານ QR ດຽວກັນຊ້ຳໆ ຂະນະລູກຄ້າຍັງຖືໂທລະສັບຄ້າງໄວ້
          const now = Date.now();
          if (lastRef.current?.text === text && now - lastRef.current.at < 4000) return;
          lastRef.current = { text, at: now };
          if (UUID_RE.test(text)) void handleRef.current({ qrToken: text.toLowerCase() });
          else if (CODE_RE.test(text.toUpperCase())) void handleRef.current({ bookingCode: text.toUpperCase() });
          else showRef.current({ kind: "invalid", bookingCode: null, lines: [], previous: null, visitDate: null });
        };
        stopLoop = frameLoop(() => void tick());
      } catch {
        if (!disposed) setCameraState("denied");
      }
    })();
    return () => {
      disposed = true;
      stopLoop?.();
      camera?.stop();
    };
  }, [gate]);

  // ນັບຖອຍຫຼັງ ແລ້ວກັບໄປສະແກນເອງ (ສະເພາະຜົນທີ່ຜ່ານ)
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- ໝົດເວລາສະແດງຜົນ */
      setDisplay(null);
      setCountdown(null);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const dismiss = () => {
    setDisplay(null);
    setCountdown(null);
  };

  if (!gate) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-3 p-4">
        <h1 className="text-xl font-bold">{s.chooseGate}</h1>
        {gates.map((g) => (
          <Button
            key={g}
            size="lg"
            className="min-h-14 text-lg"
            onClick={() => {
              setGate(g);
              save(KEYS.gate, g);
            }}
          >
            {g}
          </Button>
        ))}
      </div>
    );
  }

  const style = display ? STYLE[display.kind] : null;
  const total = display?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm">
        <span className="font-semibold">{t(s.gate, { gate })}</span>
        <span className={cn("inline-flex items-center gap-1 font-semibold", online ? "text-success" : "text-offline")}>
          {online ? <Wifi aria-hidden className="size-4" /> : <WifiOff aria-hidden className="size-4" />}
          {online ? s.online : s.offline}
        </span>
        {queue.length > 0 && <span className="text-offline">{t(s.queued, { n: queue.length })}</span>}
        <span className="text-muted-foreground">
          {manifest ? t(s.manifestAge, { time: hhmm(manifest.generatedAt) }) : s.manifestMissing}
        </span>
        {syncFailed && <span className="text-destructive">{s.syncError}</span>}
      </div>

      {conflicts.length > 0 && (
        <section role="alert" className="m-3 rounded-xl border-2 border-destructive bg-destructive-subtle p-3">
          <h2 className="flex items-center gap-2 font-bold text-destructive">
            <ShieldAlert aria-hidden className="size-5" />
            {t(s.conflictsTitle, { n: conflicts.length })}
          </h2>
          <p className="text-sm">{s.conflictsHint}</p>
          <ul className="my-2 text-sm">
            {conflicts.map((c) => (
              <li key={c.offlineId} className="tabular-nums">
                {t(s.conflictItem, { code: c.bookingCode ?? "—", result: s.result[c.result as Kind] ?? c.result, time: hhmm(c.scannedAt) })}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="min-h-11 text-base"
            onClick={() => {
              setConflicts([]);
              save(KEYS.conflicts, []);
            }}
          >
            {s.acknowledge}
          </Button>
        </section>
      )}

      <div className="relative flex flex-1 items-center justify-center bg-black">
        <video ref={videoRef} playsInline muted aria-label={s.pointCamera} className="h-full max-h-[60dvh] w-full object-cover" />
        {cameraState !== "on" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <Camera aria-hidden className="size-10" />
            <p>{cameraState === "denied" ? s.cameraDenied : s.pointCamera}</p>
          </div>
        )}
        {cameraState === "on" && <p className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">{s.pointCamera}</p>}
      </div>

      {/* ປຸ່ມຢູ່ເຄິ່ງລຸ່ມ — ນິ້ວໂປ້ເອື້ອມເຖິງ */}
      <div className="grid gap-2 p-3">
        <Button size="lg" variant="outline" className="min-h-14 text-lg" onClick={() => setManualOpen(true)}>
          <Keyboard aria-hidden />
          {s.manual}
        </Button>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogTitle className="text-lg">{s.manualTitle}</DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const code = manualCode.trim().toUpperCase();
              if (!CODE_RE.test(code)) return;
              setManualOpen(false);
              setManualCode("");
              void handle({ bookingCode: code });
            }}
            className="flex flex-col gap-3"
          >
            <Input
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={s.codeHint}
              aria-label={s.manualTitle}
              className="min-h-12 text-xl uppercase tracking-widest"
            />
            {manualCode && !CODE_RE.test(manualCode.trim().toUpperCase()) && <p className="text-sm text-destructive">{s.codeInvalid}</p>}
            <DialogFooter>
              <Button type="submit" size="lg" className="min-h-12 w-full text-base" disabled={!CODE_RE.test(manualCode.trim().toUpperCase())}>
                {s.manualSubmit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {display && style && (
        <div role="alert" aria-live="assertive" className={cn("fixed inset-0 z-50 flex flex-col p-6", style.bg)}>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <style.icon aria-hidden className="size-24" strokeWidth={2.5} />
            <p className="text-4xl font-bold">{s.result[display.kind]}</p>
            {s.hint[display.kind] && <p className="text-xl">{s.hint[display.kind]}</p>}
            {display.previous && (
              <p className="text-xl">{t(s.previous, { time: hhmm(display.previous.scannedAt), gate: display.previous.gate })}</p>
            )}
            {display.kind === "wrong_date" && display.visitDate && <p className="text-xl">{t(s.ticketDate, { date: dmy(display.visitDate) })}</p>}
            {display.lines.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-3xl font-bold">
                {display.lines.map((l) => (
                  <li key={`${l.visitorGroup}-${l.ageGroup}`} className="flex items-center justify-center gap-2">
                    {/* ຂໍ້ຕົກລົງ 23: ແຍກກຸ່ມດ້ວຍປ້າຍ ບໍ່ແມ່ນສີຢ່າງດຽວ — ພະນັກງານກວດບັດໄດ້ */}
                    <span className="rounded-md border-2 border-current px-2 text-xl">{l.visitorGroup === "lao" ? s.groupLao : s.groupForeigner}</span>
                    {s.age[l.ageGroup]} {l.quantity}
                  </li>
                ))}
                <li className="text-xl font-semibold">{t(s.total, { n: total })}</li>
              </ul>
            )}
            {display.bookingCode && <p className="text-xl tabular-nums tracking-wider">{display.bookingCode}</p>}
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="min-h-16 w-full text-xl"
            onClick={dismiss}
            autoFocus
          >
            {countdown !== null ? t(s.nextIn, { n: countdown }) : s.next}
          </Button>
        </div>
      )}
    </div>
  );
}
