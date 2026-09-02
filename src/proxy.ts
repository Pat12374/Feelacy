import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AGE_COOKIE } from "@/lib/security/cookies";
import { defaultLocale, isAppLocale } from "@/i18n/config";

/**
 * Soft age gate: home, search, and listing browse stay public.
 * Purchase and seller routes still require the age cookie. The account page
 * remains visible after sign-in so users can see what eligibility step is
 * blocking buying or selling.
 * Checkout actions also re-check ageVerifiedAt in the database.
 */
const AGE_REQUIRED_PREFIXES = [
  "/sell",
  "/admin",
  "/checkout",
];

function requiresAge(pathname: string): boolean {
  return AGE_REQUIRED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (requiresAge(pathname)) {
    const age = request.cookies.get(AGE_COOKIE)?.value;
    if (age !== "1") {
      const url = request.nextUrl.clone();
      url.pathname = "/age-gate";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();

  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (localeCookie && !isAppLocale(localeCookie)) {
    response.cookies.set("NEXT_LOCALE", defaultLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=()",
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
