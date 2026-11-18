import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type Db = typeof prisma | Prisma.TransactionClient;

// ຄ່າທຸລະກິດທັງໝົດອ່ານຈາກຕາຕະລາງ settings (ຫ້າມ hardcode) — min/max ແມ່ນຂອບເຂດກວດຄວາມຖືກຕ້ອງເທົ່ານັ້ນ
export const INT_SETTINGS = {
  session_hours: { min: 1, max: 24 },
  login_max_attempts: { min: 1, max: 100 },
  login_lockout_minutes: { min: 1, max: 1440 },
  booking_hold_minutes: { min: 5, max: 1440 },
  max_visitors_per_day: { min: 1, max: 100_000 },
  max_people_per_booking: { min: 1, max: 10_000 },
  max_advance_days: { min: 1, max: 730 },
  booking_create_limit_per_ip: { min: 1, max: 100_000 },
  booking_create_window_minutes: { min: 1, max: 1440 },
  pos_grace_minutes: { min: 0, max: 180 },
  distance_lookup_limit_per_ip: { min: 1, max: 100_000 },
  distance_lookup_window_minutes: { min: 1, max: 1440 },
} as const;

export type IntSettingKey = keyof typeof INT_SETTINGS;
export type BoolSettingKey = "pos_auto_checkin" | "translations_reviewed_zh" | "translations_reviewed_th";

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

// ຂໍ້ຕົກລົງ 28: ຄ່າທີ່ຍັງວ່າງ ຫຼື ຂຶ້ນຕົ້ນດ້ວຍ "TODO" ຖືວ່າຍັງບໍ່ໄດ້ຕັ້ງ
export function isConfigured(value: string | undefined): value is string {
  return !!value && !/^TODO/i.test(value);
}

export const NOTE_LOCALES = ["lo", "en", "zh", "th"] as const;
type NoteLocale = (typeof NOTE_LOCALES)[number];

export type BankTransferInfo =
  | {
      configured: true;
      bankName: string;
      accountNumber: string;
      accountName: string;
      verifyTimeNote: Record<NoteLocale, string>;
    }
  | { configured: false };

// ເປີດຈອງ online ໄດ້ເມື່ອຂໍ້ມູນບັນຊີ ແລະ verify_time_note ຄົບ 4 ພາສາ (ຂໍ້ຕົກລົງ 28)
// — ລູກຄ້າອ່ານຂໍ້ຄວາມນີ້ຕອນກຳລັງຈະໂອນເງິນ ຈຶ່ງຕ້ອງອ່ານອອກທຸກພາສາ
export async function getBankTransferInfo(db: Db = prisma): Promise<BankTransferInfo> {
  const noteKeys = NOTE_LOCALES.map((l) => `verify_time_note_${l}`);
  const rows = await db.settings.findMany({
    where: { setting_key: { in: ["bank_name", "bank_account_number", "bank_account_name", ...noteKeys] } },
    select: { setting_key: true, setting_value: true },
  });
  const v: Record<string, string | undefined> = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value.trim()]));
  const required = [v.bank_name, v.bank_account_number, v.bank_account_name, ...noteKeys.map((k) => v[k])];
  if (!required.every(isConfigured)) return { configured: false };
  return {
    configured: true,
    bankName: v.bank_name!,
    accountNumber: v.bank_account_number!,
    accountName: v.bank_account_name!,
    verifyTimeNote: Object.fromEntries(NOTE_LOCALES.map((l) => [l, v[`verify_time_note_${l}`]!])) as Record<NoteLocale, string>,
  };
}

export const GATE_NAME = /^[a-z0-9_-]{1,30}$/;

// ຂໍ້ຕົກລົງ 35: ລາຍຊື່ປະຕູຄັ່ນດ້ວຍ comma — ຢ່າງໜ້ອຍ 1 · ຊື່ເປັນ a-z 0-9 _ - (ບັນທຶກໃນ check_ins.gate VARCHAR(30))
export async function getGates(db: Db = prisma): Promise<string[]> {
  const raw = (await readRaw(db, "gates")) ?? "";
  const gates = [...new Set(raw.split(",").map((g) => g.trim()).filter(Boolean))];
  if (gates.length === 0 || !gates.every((g) => GATE_NAME.test(g))) {
    throw new SettingError('settings.gates must be a comma-separated list like "main" or "main,north"');
  }
  return gates;
}

export async function getBoolSetting(key: BoolSettingKey, db: Db = prisma): Promise<boolean> {
  const raw = await readRaw(db, key);
  if (raw !== "true" && raw !== "false") throw new SettingError(`settings.${key} must be "true" or "false"`);
  return raw === "true";
}
