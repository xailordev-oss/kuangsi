// ບໍ່ແຕະ DB (ທົດສອບໄດ້ໂດຍບໍ່ມີ DB) — cache ຢູ່ lib/geo/road-distance.ts
import { haversineKm, KUANGSI, ROAD_FACTOR_FALLBACK, type LatLng } from "@/lib/geo/distance";

// requirements 4.6: interface ດຽວ — OpenRouteService ຕອນພັດທະນາ → Google Routes ຕອນໃຊ້ຈິງ
export type RouteResult = { distanceKm: number; durationMin: number; provider: string };

export interface RoutingProvider {
  readonly name: string;
  getRoute(from: LatLng, to: LatLng): Promise<RouteResult>;
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 5_000;

// https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/get
export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = "openrouteservice";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
    const url = new URL("https://api.openrouteservice.org/v2/directions/driving-car");
    url.searchParams.set("start", `${from.lng},${from.lat}`);
    url.searchParams.set("end", `${to.lng},${to.lat}`);
    // key ຢູ່ໃນ header (ບໍ່ໃສ່ໃນ URL — ກັນຫຼຸດໄປໃນ log)
    const res = await this.fetchImpl(url, {
      headers: { Authorization: this.apiKey, Accept: "application/geo+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`openrouteservice ${res.status}`);
    const body = (await res.json()) as { features?: { properties?: { summary?: { distance?: number; duration?: number } } }[] };
    const summary = body.features?.[0]?.properties?.summary;
    if (typeof summary?.distance !== "number" || typeof summary.duration !== "number") throw new Error("openrouteservice: no route");
    return { distanceKm: summary.distance / 1000, durationMin: Math.max(1, Math.round(summary.duration / 60)), provider: this.name };
  }
}

// TODO(deploy): GoogleRoutesProvider (Routes API computeRoutes) — ມີຄ່າໃຊ້ຈ່າຍ ຕ້ອງໃຫ້ຜູ້ໃຊ້ອະນຸມັດ (ຂໍ້ຕົກລົງ 37)
export function routingProviderFromEnv(env: Record<string, string | undefined> = process.env): RoutingProvider | null {
  const key = env.ORS_API_KEY?.trim();
  return key ? new OpenRouteServiceProvider(key) : null;
}

export type RoadDistance = RouteResult & {
  // true = ຄ່າປະມານ (ເສັ້ນຊື່ × 1.5) ເພາະບໍ່ມີ key / API ລົ້ມ — UI ຕ້ອງໝາຍ "ປະມານ"
  approximate: boolean;
  cached: boolean;
};

// ສະເລ່ຍ 40 ກມ/ຊມ ສຳລັບຄ່າປະມານເທົ່ານັ້ນ (ທາງພູ) — ບໍ່ໃຊ້ເມື່ອມີຜົນຈາກ routing API
const FALLBACK_KMH = 40;

export function approximateRoad(from: LatLng, to: LatLng = KUANGSI): RoadDistance {
  const distanceKm = haversineKm(from, to) * ROAD_FACTOR_FALLBACK;
  return { distanceKm, durationMin: Math.max(1, Math.round((distanceKm / FALLBACK_KMH) * 60)), provider: "haversine", approximate: true, cached: false };
}
