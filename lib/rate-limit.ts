// ຈຳກັດຈຳນວນຄັ້ງຕໍ່ key ໃນໜ້າຕ່າງເວລາ (sliding window) — ເກັບໃນ memory ຂອງ process
// ຂໍ້ຈຳກັດ: restart ແລ້ວນັບໃໝ່ · ຖ້າແລ່ນຫຼາຍ instance ຈະນັບແຍກກັນ (ພໍສຳລັບ server ດຽວ)
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function hitRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const since = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > since);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) {
    for (const [k, times] of hits) if (times.every((t) => t <= since)) hits.delete(k);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Next ຕັ້ງ x-forwarded-for ເປັນ IP ຂອງ socket ສະເພາະເມື່ອ client ບໍ່ໄດ້ສົ່ງມາເອງ
// → ຕອນ deploy ຕ້ອງມີ reverse proxy (nginx/Caddy) ທີ່ຕໍ່ IP ແທ້ໄວ້ທ້າຍ header ນີ້ສະເໝີ
// ໃຊ້ຄ່າສຸດທ້າຍ = ຄ່າທີ່ proxy ຂອງເຮົາໃສ່ (client ປອມໄດ້ແຕ່ຄ່າທາງໜ້າ)
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  return last || "unknown";
}
