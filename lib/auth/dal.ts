import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, isRole, type Permission, type Role } from "@/lib/auth/roles";
import { isSessionLive } from "@/lib/auth/session";

export type StaffUser = {
  id: bigint;
  username: string;
  fullName: string;
  role: Role;
};

export class AuthzError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "unauthenticated" : "forbidden");
  }
}

// ອ່ານຈາກ DB ທຸກຄັ້ງ: ປິດບັນຊີ ຫຼື ປ່ຽນບົດບາດ ມີຜົນທັນທີ ບໍ່ຕ້ອງລໍ JWT ໝົດອາຍຸ
export async function loadActiveStaffUser(id: string): Promise<StaffUser | null> {
  if (!/^\d+$/.test(id)) return null;
  const user = await prisma.users.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, username: true, full_name: true, role: true, is_active: true },
  });
  if (!user?.is_active || !isRole(user.role)) return null;
  return { id: user.id, username: user.username, fullName: user.full_name, role: user.role };
}

export const getCurrentUser = cache(async (): Promise<StaffUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || !isSessionLive(session.sessionExpiresAt)) return null;
  return loadActiveStaffUser(id);
});

export async function requirePermission(permission: Permission): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError(401);
  if (!can(user.role, permission)) throw new AuthzError(403);
  return user;
}

export function authzErrorResponse(error: unknown): Response {
  if (error instanceof AuthzError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
