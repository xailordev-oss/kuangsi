import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";

export const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export const PASSWORD_MIN_LENGTH = 10;
// bcrypt ໃຊ້ພຽງ 72 bytes ທຳອິດ — ຕົວອັກສອນລາວ 1 ຕົວ = 3 bytes
const BCRYPT_MAX_BYTES = 72;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .refine((p) => new TextEncoder().encode(p).length <= BCRYPT_MAX_BYTES, {
    message: `password must be at most ${BCRYPT_MAX_BYTES} bytes`,
  });

export const userUpsertSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-z0-9_.-]+$/),
  role: z.enum(ROLES),
  email: z.email().max(255).optional(),
  fullName: z.string().trim().min(1).max(150).optional(),
  password: newPasswordSchema,
});
