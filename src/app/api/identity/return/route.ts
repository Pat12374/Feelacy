import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retrieveAndApplyStripeIdentityResult } from "@/lib/identity";
import { AGE_COOKIE } from "@/lib/security/cookies";
import { isProduction } from "@/lib/security/env";

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/search";
}

function appRedirect(path: string) {
  return new URL(
    path,
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!session?.user?.id) {
    return NextResponse.redirect(
      appRedirect(`/login?next=${encodeURIComponent(next)}`),
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeIdentityVerificationId: true },
  });
  if (!user?.stripeIdentityVerificationId) {
    return NextResponse.redirect(
      appRedirect(`/age-gate?error=session&next=${encodeURIComponent(next)}`),
    );
  }

  try {
    const result = await retrieveAndApplyStripeIdentityResult(
      user.stripeIdentityVerificationId,
    );
    if (result !== "VERIFIED") {
      const state = result === "UNDERAGE" ? "underage" : result.toLowerCase();
      return NextResponse.redirect(
        appRedirect(
          `/age-gate?status=${state}&next=${encodeURIComponent(next)}`,
        ),
      );
    }
  } catch (error) {
    console.error("Stripe Identity return processing failed", { error });
    return NextResponse.redirect(
      appRedirect(`/age-gate?error=unavailable&next=${encodeURIComponent(next)}`),
    );
  }

  const response = NextResponse.redirect(appRedirect(next));
  response.cookies.set(AGE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
