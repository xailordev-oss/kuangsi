import { z } from "zod";
import { BusinessError } from "@/lib/api";
import { writeAudit, type Actor } from "@/lib/admin/audit";
import { generateTempPassword } from "@/lib/admin/password";
import { hashPassword } from "@/lib/auth/password";
import { ROLES, type Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/settings";

export const createUserSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(50).regex(/^[a-z0-9_.-]+$/),
  fullName: z.string().trim().min(1).max(150),
  email: z.email().trim().toLowerCase().max(255),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: z.enum(ROLES) }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("reset_password") }),
  z.object({ action: z.literal("unlock") }),
]);
export type UpdateUser = z.infer<typeof updateUserSchema>;

export async function listUsers(now = new Date()) {
  const rows = await prisma.users.findMany({
    orderBy: [{ is_active: "desc" }, { role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, full_name: true, email: true, role: true, is_active: true, last_login_at: true, locked_until: true },
  });
  return rows.map((u) => ({
    id: String(u.id),
    username: u.username,
    fullName: u.full_name,
    email: u.email,
    role: u.role as Role,
    isActive: u.is_active,
    lastLoginAt: u.last_login_at?.toISOString() ?? null,
    lockedUntil: u.locked_until && u.locked_until > now ? u.locked_until.toISOString() : null,
  }));
}

function duplicateField(error: unknown): "username" | "email" | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  return JSON.stringify(error.meta ?? {}).includes("email") ? "email" : "username";
}

// ຂໍ້ຕົກລົງ 46: ລະຫັດຊົ່ວຄາວຄືນໃຫ້ຜູ້ເອີ້ນເທື່ອດຽວ — ບໍ່ເກັບ ບໍ່ໃສ່ audit
export async function createUser(input: z.infer<typeof createUserSchema>, actor: Actor) {
  const password = generateTempPassword();
  const password_hash = await hashPassword(password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: { username: input.username, full_name: input.fullName, email: input.email, role: input.role, password_hash },
        select: { id: true },
      });
      await writeAudit(tx, actor, { action: "user.create", table: "users", recordId: u.id, oldValue: null, newValue: { username: input.username, role: input.role, isActive: true } });
      return u;
    });
    return { id: String(user.id), password };
  } catch (error) {
    const field = duplicateField(error);
    if (field) throw new BusinessError(409, `${field}_taken`);
    throw error;
  }
}

// ຂໍ້ຕົກລົງ 45: ລັອກແຖວ admin ທີ່ເປີດຢູ່ທັງໝົດ (ລຽງຕາມ id ກັນ deadlock) ກ່ອນນັບ
// → 2 admin ທີ່ປິດກັນແລະກັນພ້ອມກັນ ຈະເຂົ້າຄິວ ແລະ ອັນທີ 2 ເຫັນວ່າເຫຼືອຄົນດຽວ
async function lockActiveAdmins(tx: Db): Promise<bigint[]> {
  const rows = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id FOR UPDATE`;
  return rows.map((r) => r.id);
}

export async function updateUser(targetId: bigint, change: UpdateUser, actor: Actor): Promise<{ password?: string }> {
  // bcrypt ຊ້າ — ສ້າງ hash ນອກ transaction (ບໍ່ຖືລັອກດົນ)
  const password = change.action === "reset_password" ? generateTempPassword() : undefined;
  const password_hash = password ? await hashPassword(password) : undefined;

  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const admins = await lockActiveAdmins(tx);
        // ຜູ້ສັ່ງອາດຖືກປິດ / ລົດບົດບາດ ໂດຍ request ອື່ນທີ່ commit ກ່ອນ (ສິດກວດຕອນເລີ່ມ request) → ກວດຊ້ຳພາຍໃນລັອກ
        if (!admins.includes(actor.id)) throw new BusinessError(403, "forbidden");
        const [target] = await tx.$queryRaw<{ id: bigint; role: Role; is_active: number | boolean; username: string }[]>`
          SELECT id, role, is_active, username FROM users WHERE id = ${targetId} FOR UPDATE`;
        if (!target) throw new BusinessError(404, "user_not_found");
        const active = Boolean(Number(target.is_active));
        const removesAdmin =
          target.role === "admin" && active && (change.action === "deactivate" || (change.action === "role" && change.role !== "admin"));

        // last_admin ກ່ອນ: admin ຄົນດຽວທີ່ປິດຕົນເອງ ໄດ້ເຫດຜົນທີ່ຖືກ "ຕ້ອງມີ admin ຢ່າງໜ້ອຍ 1 ຄົນ"
        if (removesAdmin && admins.length <= 1) throw new BusinessError(409, "last_admin");
        if (removesAdmin && target.id === actor.id) throw new BusinessError(409, "cannot_change_self");

        switch (change.action) {
          case "role":
            if (change.role === target.role) return;
            await tx.users.update({ where: { id: targetId }, data: { role: change.role } });
            await writeAudit(tx, actor, { action: "user.role", table: "users", recordId: targetId, oldValue: { role: target.role }, newValue: { role: change.role } });
            return;
          case "deactivate":
            if (!active) return;
            await tx.users.update({ where: { id: targetId }, data: { is_active: false } });
            await writeAudit(tx, actor, { action: "user.deactivate", table: "users", recordId: targetId, oldValue: { isActive: true }, newValue: { isActive: false } });
            return;
          case "activate":
            if (active) return;
            await tx.users.update({ where: { id: targetId }, data: { is_active: true } });
            await writeAudit(tx, actor, { action: "user.activate", table: "users", recordId: targetId, oldValue: { isActive: false }, newValue: { isActive: true } });
            return;
          case "reset_password":
            // ຂໍ້ຕົກລົງ 22: ຕັ້ງລະຫັດໃໝ່ = ປົດລັອກ
            await tx.users.update({ where: { id: targetId }, data: { password_hash, failed_login_count: 0, locked_until: null } });
            await writeAudit(tx, actor, { action: "user.password_reset", table: "users", recordId: targetId, oldValue: null, newValue: { unlocked: true } });
            return;
          case "unlock":
            await tx.users.update({ where: { id: targetId }, data: { failed_login_count: 0, locked_until: null } });
            await writeAudit(tx, actor, { action: "user.unlock", table: "users", recordId: targetId, oldValue: null, newValue: { unlocked: true } });
            return;
        }
      });
      return password ? { password } : {};
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt === 0) continue;
      throw error;
    }
  }
}
