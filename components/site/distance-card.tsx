"use client";

import { LocateFixed, MapPin, Navigation, RotateCcw, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  distanceTier,
  haversineKm,
  KUANGSI,
  LOW_ACCURACY_M,
  mapsDirectionsUrl,
  ON_SITE_KM,
  roundCoord,
  type LatLng,
} from "@/lib/geo/distance";
import type { DistanceAnswer } from "@/lib/geo/road-distance";
import { useMyLocation } from "@/lib/geo/use-my-location";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/format";

export type DistancePlace = { id: string; name: string; lat: number; lng: number; distanceKm: number | null; durationMin: number | null };

type Origin = { point: LatLng; accuracy: number | null; placeName: string | null; known?: { km: number; min: number } };
type Result =
  | { kind: "road"; km: number; min: number; approximate: boolean; fromTown: boolean }
  | { kind: "straight"; km: number; reason: "offline" | "rateLimited" | "error" }
  | { kind: "onSite" };

const kmFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function driveTime(min: number, d: Dictionary["distance"]): string {
  return min < 60 ? t(d.driveTime, { min }) : t(d.driveTimeHours, { h: Math.floor(min / 60), min: min % 60 });
}

// DistanceCard (docs/ui-plan.md §3.1, ຕາຕະລາງ component): ກ່ອນກົດ · ກຳລັງຫາ · ປະຕິເສດ (→ places) · ຜົນ · ປະມານ · ຢູ່ໃນພື້ນທີ່ແລ້ວ
// ສົ່ງສະເພາະຂໍ້ຄວາມ distance ໄປ client (ບໍ່ສົ່ງ dictionary ທັງໝົດ)
export function DistanceCard({ places, lang, d }: { places: DistancePlace[]; lang: string; d: Dictionary["distance"] }) {
  const { location, error, loading, locate } = useMyLocation();
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeId, setPlaceId] = useState("");

  // GPS ໄດ້ຕຳແໜ່ງ → ຄຳນວນ (setState ໃນ callback ຂອງ fetch ບໍ່ແມ່ນໃນ effect ໂດຍກົງ)
  useEffect(() => {
    if (location) void measure({ point: { lat: location.lat, lng: location.lng }, accuracy: location.accuracy, placeName: null });
  }, [location]);

  async function measure(o: Origin) {
    setOrigin(o);
    const straightKm = haversineKm(o.point, KUANGSI);
    if (straightKm < ON_SITE_KM) {
      setResult({ kind: "onSite" });
      return;
    }
    if (o.known) {
      setResult({ kind: "road", km: o.known.km, min: o.known.min, approximate: false, fromTown: false });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      // ຂໍ້ຕົກລົງ 7: ສົ່ງສະເພາະພິກັດທີ່ປັດແລ້ວ (~1 ກມ) — ພິກັດແທ້ບໍ່ອອກຈາກເຄື່ອງ
      const res = await fetch("/api/public/distance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(roundCoord(o.point)),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        setResult({ kind: "straight", km: straightKm, reason: res.status === 429 ? "rateLimited" : "error" });
        return;
      }
      const a = (await res.json()) as DistanceAnswer;
      setResult(
        a.onSite || !a.road
          ? { kind: "onSite" }
          : { kind: "road", km: a.road.distanceKm, min: a.road.durationMin, approximate: a.road.approximate, fromTown: a.fromTown },
      );
    } catch {
      // ເນັດຂາດ → ເສັ້ນຊື່ຢ່າງດຽວ ພ້ອມປ້າຍ (requirements 4.10)
      setResult({ kind: "straight", km: straightKm, reason: "offline" });
    } finally {
      setBusy(false);
    }
  }

  function choosePlace(id: string) {
    setPlaceId(id);
    const p = places.find((x) => x.id === id);
    if (!p) return;
    const known = p.distanceKm !== null && p.durationMin !== null ? { km: p.distanceKm, min: p.durationMin } : undefined;
    void measure({ point: { lat: p.lat, lng: p.lng }, accuracy: null, placeName: p.name, known });
  }

  const lowAccuracy = origin?.accuracy != null && origin.accuracy > LOW_ACCURACY_M;
  const errorText = error ? { denied: d.denied, unavailable: d.unavailable, timeout: d.timeout, unsupported: d.unsupported }[error] : null;
  // ຢູ່ໄກ (ໄລຍະຈາກຕົວເມືອງ) → ໃຫ້ແອັບແຜນທີ່ໃຊ້ຕຳແໜ່ງຂອງເຄື່ອງເອງ
  const links = mapsDirectionsUrl(result?.kind === "road" && result.fromTown ? null : (origin?.point ?? null));

  return (
    <Card aria-labelledby="distance-title">
      <CardHeader>
        <CardTitle id="distance-title" className="flex items-center gap-2 text-lg">
          <MapPin aria-hidden className="size-5 text-primary" />
          {d.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-live="polite">
        {!result && !busy && !loading && (
          <>
            <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={locate}>
              <LocateFixed aria-hidden />
              {d.cta}
            </Button>
            <p className="text-sm text-muted-foreground">{d.why}</p>
          </>
        )}
        {(loading || busy) && <p className="text-muted-foreground">{loading ? d.locating : d.calculating}</p>}
        {errorText && !result && <p role="alert" className="text-warning">{errorText}</p>}

        {result?.kind === "onSite" && (
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold text-success">{d.onSite}</p>
            <p className="text-muted-foreground">{d.onSiteHint}</p>
            <Button asChild className="min-h-12 w-full text-base">
              <Link href={`/${lang}/lookup`}>
                <Ticket aria-hidden />
                {d.myTicket}
              </Link>
            </Button>
          </div>
        )}

        {result && result.kind !== "onSite" && (
          <div className="flex flex-col gap-1" data-testid="distance-result">
            <p className="text-2xl font-bold">
              {origin?.placeName
                ? t(d.awayFrom, { place: origin.placeName, km: kmFormat.format(result.km) })
                : t(d.away, { km: kmFormat.format(result.km) })}
            </p>
            {result.kind === "road" && <p className="text-lg">{driveTime(result.min, d)}</p>}
            {/* h-auto: Badge ຂອງ shadcn ສູງ h-5 ຕາຍຕົວ → ຕັດວັນນະຍຸດລາວ */}
            {(result.kind === "straight" || result.approximate || lowAccuracy) && (
              <Badge variant="outline" className="h-auto w-fit border-warning py-0.5 text-sm text-warning">
                {d.approx}
              </Badge>
            )}
            {result.kind === "straight" && (
              <p className="text-sm text-muted-foreground">
                {result.reason === "offline" ? d.straightLine : result.reason === "rateLimited" ? d.rateLimited : d.error}
              </p>
            )}
            {result.kind === "road" && result.approximate && <p className="text-sm text-muted-foreground">{d.approxHint}</p>}
            {lowAccuracy && origin?.accuracy != null && (
              <p className="text-sm text-muted-foreground">{t(d.lowAccuracy, { m: Math.round(origin.accuracy) })}</p>
            )}
            {result.kind === "road" && result.fromTown && <p className="text-sm text-muted-foreground">{d.fromTown}</p>}
            <p className="mt-1">{d.tier[distanceTier(result.km)]}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="min-h-12 flex-1 text-base">
                <a href={links.google} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden />
                  {d.openMaps}
                </a>
              </Button>
              <Button asChild variant="outline" className="min-h-12 text-base">
                <a href={links.apple} target="_blank" rel="noopener noreferrer">
                  {d.openAppleMaps}
                </a>
              </Button>
            </div>
          </div>
        )}

        {result && !busy && (
          <Button type="button" variant="ghost" className="min-h-11 w-fit" onClick={() => { setResult(null); setOrigin(null); setPlaceId(""); }}>
            <RotateCcw aria-hidden />
            {d.retry}
          </Button>
        )}

        {places.length > 0 && !busy && !loading && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{d.choosePlace}</span>
            <select
              value={placeId}
              onChange={(e) => choosePlace(e.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              <option value="">{d.placeholder}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </CardContent>
    </Card>
  );
}
