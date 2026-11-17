import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { canAccessPath, homePathForRole, isRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { isSessionLive } from "@/lib/auth/session";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "@/lib/i18n/config";

// ກວດແບບ optimistic ຈາກ JWT ໃນ cookie ເທົ່ານັ້ນ (ບໍ່ແຕະ DB)
// ການກວດແທ້ (ບັນຊີຍັງເປີດ, ບົດບາດປັດຈຸບັນ) ຢູ່ທີ່ lib/auth/dal.ts
const { auth } = NextAuth(authConfig);

function isStaffPath(pathname: string): boolean {
  return /^\/(staff|admin)(\/|$)/.test(pathname);
}

// ລາວເປັນຄ່າເລີ່ມຕົ້ນ · ຖ້າ browser ບອກພາສາທີ່ຮອງຮັບ ໃຊ້ພາສານັ້ນ
function preferredLocale(req: NextRequest): Locale {
  const header = req.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((x) => hasLocale(x.lang));
  return match ? (match.lang as Locale) : DEFAULT_LOCALE;
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (!isStaffPath(pathname)) {
    const first = pathname.split("/")[1] ?? "";
    if (hasLocale(first)) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

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
  // ທຸກໜ້າ ຍົກເວັ້ນ API, ໄຟລ໌ຂອງ Next ແລະ ໄຟລ໌ທີ່ມີນາມສະກຸນ (favicon.ico, ຮູບ…)
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
