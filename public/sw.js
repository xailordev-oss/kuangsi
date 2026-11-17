// Service worker ຂຽນເອງ (ຂໍ້ຕົກລົງ 34) — offline ສະເພາະ 2 ໜ້າ:
//   ໜ້າ QR ຂອງລູກຄ້າ (/[lang]/booking/KS-XXXXX ຫຼັງຈ່າຍແລ້ວ) ແລະ /staff/scan
// ໜ້າເຫຼົ່ານັ້ນເກັບຕົວເອງເຂົ້າ cache (components/site/sw-register.tsx) · SW ໃຊ້ cache ສະເພາະຕອນເນັດຂາດ
// ໜ້າອື່ນ ແລະ API ຜ່ານໄປ network ຕາມປົກກະຕິ (ບໍ່ cache)
const VERSION = "v1";
const PAGES = `ks-pages-${VERSION}`;
const STATIC = `ks-static-${VERSION}`;
const OFFLINE_PAGE = /^\/(lo|en|zh|th)\/booking\/KS-[A-Z0-9]{5}$|^\/staff\/scan$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // JS/CSS/font ຂອງ Next ມີ hash ໃນຊື່ → ບໍ່ປ່ຽນ ໃຊ້ cache ໄດ້ເລີຍ
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // network ກ່ອນ — ເນັດຂາດຈຶ່ງໃຊ້ສະບັບທີ່ໜ້ານັ້ນເກັບໄວ້
  if (request.mode === "navigate" && OFFLINE_PAGE.test(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || Response.error()),
    );
  }
});
