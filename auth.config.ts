import type { NextAuthConfig } from "next-auth";
import { isRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { SESSION_HOURS_CEILING } from "@/lib/auth/session";

// ສ່ວນທີ່ບໍ່ແຕະ DB — ໃຊ້ຮ່ວມກັນລະຫວ່າງ proxy.ts ແລະ auth.ts
export const authConfig = {
  pages: { signIn: STAFF_LOGIN_PATH },
  session: { strategy: "jwt", maxAge: SESSION_HOURS_CEILING * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id && isRole(user.role) && typeof user.sessionExpiresAt === "number") {
        token.uid = user.id;
        token.role = user.role;
        token.sessionExpiresAt = user.sessionExpiresAt;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && isRole(token.role) && typeof token.sessionExpiresAt === "number") {
        session.user.id = token.uid;
        session.user.role = token.role;
        session.sessionExpiresAt = token.sessionExpiresAt;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
