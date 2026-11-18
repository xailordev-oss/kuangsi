import { prisma } from "@/lib/db";
import { FAR_KM, haversineKm, KUANGSI, LUANG_PRABANG_TOWN, ON_SITE_KM, originKey, roundCoord, type LatLng } from "@/lib/geo/distance";
import { approximateRoad, routingProviderFromEnv, type RoadDistance, type RoutingProvider } from "@/lib/geo/routing";

// requirements 4.7: ເກັບຜົນ 7 ວັນ (ເສັ້ນທາງບໍ່ປ່ຽນເລື້ອຍ) — ປະຢັດໂຄຕາ / ຄ່າໃຊ້ຈ່າຍຂອງ routing API
const CACHE_DAYS = 7;

// ຂໍ້ຕົກລົງ 7: ທຸກຢ່າງໃຊ້ພິກັດທີ່ປັດແລ້ວ — ທັງ cache key ແລະ ສິ່ງທີ່ສົ່ງໄປ provider
export async function roadDistanceToFalls(origin: LatLng, provider: RoutingProvider | null = routingProviderFromEnv()): Promise<RoadDistance> {
  const from = roundCoord(origin);
  const key = originKey(from);
  const fresh = new Date(Date.now() - CACHE_DAYS * 86_400_000);
  const hit = await prisma.route_cache.findUnique({ where: { origin_key: key } });
  const fromCache = (h: NonNullable<typeof hit>): RoadDistance => ({
    distanceKm: Number(h.distance_km),
    durationMin: h.duration_min,
    provider: h.provider,
    approximate: false,
    cached: true,
  });
  if (hit && hit.created_at > fresh) return fromCache(hit);
  // cache ເກົ່າ (ເກີນ 7 ວັນ) ຍັງດີກວ່າຄ່າປະມານ — ໃຊ້ເມື່ອບໍ່ມີ provider ຫຼື provider ລົ້ມ
  if (!provider) return hit ? fromCache(hit) : approximateRoad(from);
  try {
    const r = await provider.getRoute(from, KUANGSI);
    const row = { distance_km: r.distanceKm.toFixed(2), duration_min: r.durationMin, provider: r.provider, created_at: new Date() };
    await prisma.route_cache.upsert({ where: { origin_key: key }, create: { origin_key: key, ...row }, update: row });
    return { ...r, approximate: false, cached: false };
  } catch (error) {
    console.warn("routing failed — using approximation:", error instanceof Error ? error.message : error);
    return hit ? fromCache(hit) : approximateRoad(from);
  }
}

export type DistanceAnswer = {
  straightKm: number;
  // ຢູ່ໃນພື້ນທີ່ຕາດແລ້ວ (< 1 ກມ) → ບໍ່ຕ້ອງນຳທາງ
  onSite: boolean;
  // ຢູ່ໄກ (> 200 ກມ ເຊັ່ນ ຈອງຈາກຕ່າງປະເທດ) → road ແມ່ນໄລຍະຈາກຕົວເມືອງຫຼວງພະບາງ
  fromTown: boolean;
  road: RoadDistance | null;
};

export async function distanceToFalls(origin: LatLng): Promise<DistanceAnswer> {
  const from = roundCoord(origin);
  const straightKm = haversineKm(from, KUANGSI);
  if (straightKm < ON_SITE_KM) return { straightKm, onSite: true, fromTown: false, road: null };
  const fromTown = straightKm > FAR_KM;
  return { straightKm, onSite: false, fromTown, road: await roadDistanceToFalls(fromTown ? LUANG_PRABANG_TOWN : from) };
}
