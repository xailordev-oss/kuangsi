import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type Db = typeof prisma | Prisma.TransactionClient;

// ຄ່າທຸລະກິດທັງໝົດອ່ານຈາກຕາຕະລາງ settings (ຫ້າມ hardcode) — min/max ແມ່ນຂອບເຂດກວດຄວາມຖືກຕ້ອງເທົ່ານັ້ນ
const INT_SETTINGS = {
  session_hours: { min: 1, max: 24 },
  login_max_attempts: { min: 1, max: 100 },
  login_lockout_minutes: { min: 1, max: 1440 },
  booking_hold_minutes: { min: 5, max: 1440 },
  max_visitors_per_day: { min: 1, max: 100_000 },
} as const;

const BOOL_SETTINGS = ["pos_auto_checkin"] as const;

export type IntSettingKey = keyof typeof INT_SETTINGS;
export type BoolSettingKey = (typeof BOOL_SETTINGS)[number];

export class SettingError extends Error {}

async function readRaw(db: Db, key: string): Promise<string | undefined> {
  const row = await db.settings.findUnique({ where: { setting_key: key }, select: { setting_value: true } });
  return row?.setting_value.trim();
}

export async function getIntSetting(key: IntSettingKey, db: Db = prisma): Promise<number> {
  const { min, max } = INT_SETTINGS[key];
  const raw = await readRaw(db, key);
  const value = raw === undefined || !/^\d+$/.test(raw) ? NaN : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new SettingError(`settings.${key} is missing or not an integer in [${min}, ${max}]`);
  }
  return value;
}

export async function getBoolSetting(key: BoolSettingKey, db: Db = prisma): Promise<boolean> {
  const raw = await readRaw(db, key);
  if (raw !== "true" && raw !== "false") throw new SettingError(`settings.${key} must be "true" or "false"`);
  return raw === "true";
}
