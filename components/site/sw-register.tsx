"use client";

import { useEffect } from "react";

const PAGES_CACHE = "ks-pages-v1";

// ລົງທະບຽນ /sw.js ແລະ ເກັບໜ້ານີ້ໄວ້ໃຊ້ຕອນເນັດຂາດ (ຂໍ້ຕົກລົງ 34) — ໃຊ້ສະເພາະໜ້າ QR (paid) ແລະ /staff/scan
export function OfflinePage() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(location.pathname))
      .catch(() => undefined);
  }, []);
  return null;
}
