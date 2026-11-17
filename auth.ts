import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { isRole } from "@/lib/auth/roles";
import { credentialsSchema } from "@/lib/auth/schemas";
import { sessionExpiresAt } from "@/lib/auth/session";
import { getIntSetting } from "@/lib/settings";

// ບອກວ່າ "ບັນຊີຖືກປິດ" ສະເພາະເມື່ອລະຫັດຜ່ານຖືກ ແລະ ບໍ່ຖືກລັອກ — ກໍລະນີອື່ນຕອບແບບດຽວກັນໝົດ
// (ຊື່ຜູ້ໃຊ້ຜິດ / ລະຫັດຜິດ / ຖືກລັອກ → "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ", ຂໍ້ຕົກລົງ 22)
class AccountDisabled extends CredentialsSignin {
  code = "account_disabled";
}

async function registerFailedLogin(userId: bigint): Promise<void> {
  const [maxAttempts, lockoutMinutes] = await Promise.all([
    getIntSetting("login_max_attempts"),
    getIntSetting("login_lockout_minutes"),
  ]);
  const { failed_login_count } = await prisma.users.update({
    where: { id: userId },
    data: { failed_login_count: { increment: 1 } },
    select: { failed_login_count: true },
  });
  if (failed_login_count >= maxAttempts) {
    await prisma.users.update({
      where: { id: userId },
      data: { failed_login_count: 0, locked_until: new Date(Date.now() + lockoutMinutes * 60_000) },
    });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await prisma.users.findUnique({
          where: { username },
          select: {
            id: true, email: true, full_name: true, role: true,
            is_active: true, password_hash: true, locked_until: true,
          },
        });
        if (!user) {
          await burnPasswordCheck(password);
          return null;
        }
        // ລະຫວ່າງລັອກ: ບໍ່ກວດລະຫັດ ແລະ ບໍ່ນັບເພີ່ມ (ບໍ່ໃຫ້ຜູ້ໂຈມຕີຍືດເວລາລັອກໄປເລື້ອຍໆ)
        if (user.locked_until && user.locked_until.getTime() > Date.now()) {
          await burnPasswordCheck(password);
          return null;
        }
        if (!(await verifyPassword(password, user.password_hash))) {
          await registerFailedLogin(user.id);
          return null;
        }
        if (!user.is_active || !isRole(user.role)) throw new AccountDisabled();

        const sessionHours = await getIntSetting("session_hours");
        await prisma.users.update({
          where: { id: user.id },
          data: { last_login_at: new Date(), failed_login_count: 0, locked_until: null },
        });

        return {
          id: user.id.toString(),
          name: user.full_name,
          email: user.email,
          role: user.role,
          sessionExpiresAt: sessionExpiresAt(sessionHours),
        };
      },
    }),
  ],
});
