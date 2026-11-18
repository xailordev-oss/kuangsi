// ຄຳນວນໄລຍະຖະໜົນ + ເວລາຂັບລົດ ລ່ວງໜ້າ ສຳລັບ places (requirements 4.7) — ຕ້ອງມີ ORS_API_KEY ໃນ .env
//   npm run places:routes          ← ສະເພາະອັນທີ່ຍັງບໍ່ໄດ້ຄຳນວນ (distance_km = NULL)
//   npm run places:routes -- --all ← ຄຳນວນໃໝ່ທັງໝົດ
import { parseArgs } from "node:util";
import { prisma } from "@/lib/db";
import { KUANGSI } from "@/lib/geo/distance";
import { routingProviderFromEnv } from "@/lib/geo/routing";

async function main() {
  const { values } = parseArgs({ options: { all: { type: "boolean", default: false } } });
  const provider = routingProviderFromEnv();
  if (!provider) throw new Error("ORS_API_KEY is not set in .env — see .env.example");
  const places = await prisma.places.findMany({ where: { is_active: true, ...(!values.all && { distance_km: null }) } });
  for (const p of places) {
    try {
      const r = await provider.getRoute({ lat: Number(p.lat), lng: Number(p.lng) }, KUANGSI);
      await prisma.places.update({ where: { id: p.id }, data: { distance_km: r.distanceKm.toFixed(2), duration_min: r.durationMin } });
      console.log(`${p.name_en}: ${r.distanceKm.toFixed(1)} km · ${r.durationMin} min (${r.provider})`);
    } catch (error) {
      console.error(`${p.name_en}: failed — ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }
  console.log(`done: ${places.length} place(s)`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
