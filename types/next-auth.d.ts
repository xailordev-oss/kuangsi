import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/roles";

declare module "next-auth" {
  interface User {
    role?: Role;
    sessionExpiresAt?: number;
  }

  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
    sessionExpiresAt?: number;
  }
}

// callbacks ຂອງ NextAuthConfig ໃຊ້ JWT ຈາກ @auth/core ໂດຍກົງ (ບໍ່ແມ່ນ next-auth/jwt)
declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    sessionExpiresAt?: number;
  }
}
