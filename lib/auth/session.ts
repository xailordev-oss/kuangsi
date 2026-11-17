// ອາຍຸ session ແທ້ມາຈາກ settings.session_hours (ຕັ້ງຕອນ login) — ຄ່ານີ້ເປັນພຽງເພດານຂອງ cookie
export const SESSION_HOURS_CEILING = 24;

export function sessionExpiresAt(sessionHours: number, now = Date.now()): number {
  return now + Math.min(sessionHours, SESSION_HOURS_CEILING) * 60 * 60 * 1000;
}

export function isSessionLive(expiresAt: unknown, now = Date.now()): boolean {
  return typeof expiresAt === "number" && now < expiresAt;
}
