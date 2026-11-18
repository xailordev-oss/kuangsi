import assert from "node:assert/strict";
import { test } from "node:test";
import { KUANGSI, LUANG_PRABANG_TOWN } from "@/lib/geo/distance";
import { approximateRoad, OpenRouteServiceProvider, routingProviderFromEnv } from "@/lib/geo/routing";

function fakeFetch(status: number, body: unknown, seen: { url?: string; auth?: string } = {}) {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    seen.url = String(input);
    seen.auth = new Headers(init?.headers).get("Authorization") ?? undefined;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("ORS: ແປງ summary (ແມັດ/ວິນາທີ) → ກມ/ນາທີ · lng,lat · key ຢູ່ header ບໍ່ຢູ່ URL", async () => {
  const seen: { url?: string; auth?: string } = {};
  const p = new OpenRouteServiceProvider("test-key", fakeFetch(200, { features: [{ properties: { summary: { distance: 31234, duration: 2950 } } }] }, seen));
  const r = await p.getRoute({ lat: 19.89, lng: 102.13 }, KUANGSI);
  assert.deepEqual(r, { distanceKm: 31.234, durationMin: 49, provider: "openrouteservice" });
  assert.ok(seen.url!.includes("start=102.13%2C19.89") && seen.url!.includes("end=101.99167%2C19.74917"), seen.url);
  assert.ok(!seen.url!.includes("test-key"));
  assert.equal(seen.auth, "test-key");
});

test("ORS: HTTP error / ບໍ່ມີເສັ້ນທາງ → throw (ໃຫ້ຜູ້ເອີ້ນໃຊ້ຄ່າປະມານ)", async () => {
  await assert.rejects(new OpenRouteServiceProvider("k", fakeFetch(403, {})).getRoute(LUANG_PRABANG_TOWN, KUANGSI));
  await assert.rejects(new OpenRouteServiceProvider("k", fakeFetch(200, { features: [] })).getRoute(LUANG_PRABANG_TOWN, KUANGSI));
});

test("ບໍ່ມີ ORS_API_KEY → ບໍ່ມີ provider (ໃຊ້ຄ່າປະມານ)", () => {
  assert.equal(routingProviderFromEnv({}), null);
  assert.equal(routingProviderFromEnv({ ORS_API_KEY: "  " }), null);
  assert.ok(routingProviderFromEnv({ ORS_API_KEY: "k" }) instanceof OpenRouteServiceProvider);
});

test("ຄ່າປະມານ = ເສັ້ນຊື່ × 1.5 ແລະ ໝາຍ approximate", () => {
  const a = approximateRoad(LUANG_PRABANG_TOWN);
  assert.equal(a.approximate, true);
  assert.equal(a.provider, "haversine");
  assert.ok(a.distanceKm > 25 && a.distanceKm < 40, String(a.distanceKm));
});
