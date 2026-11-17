import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { canAccessPath, homePathForRole, isRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { isSessionLive } from "@/lib/auth/session";

// ກວດແບບ optimistic ຈາກ JWT ໃນ cookie ເທົ່ານັ້ນ (ບໍ່ແຕະ DB)
// ການກວດແທ້ (ບັນຊີຍັງເປີດ, ບົດບາດປັດຈຸບັນ) ຢູ່ທີ່ lib/auth/dal.ts
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const role = req.auth?.user?.role;
  const signedIn = isRole(role) && isSessionLive(req.auth?.sessionExpiresAt);

  if (pathname === STAFF_LOGIN_PATH) {
    return signedIn ? NextResponse.redirect(new URL(homePathForRole(role), req.nextUrl)) : NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL(STAFF_LOGIN_PATH, req.nextUrl);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  if (!canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL(homePathForRole(role), req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/staff/:path*", "/admin/:path*"],
};
