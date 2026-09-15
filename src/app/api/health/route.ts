import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authSecret, isProduction } from "@/lib/security/env";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Lightweight readiness probe for load balancers / launch checks */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 },
    );
  }

  const checks = {
    ok: true,
    env: isProduction() ? "production" : "development",
    authSecret: Boolean(authSecret()),
    stripe: isStripeConfigured(),
    demoCheckout: process.env.ALLOW_DEMO_CHECKOUT === "true",
  };

  if (isProduction() && (!checks.authSecret || !checks.stripe || checks.demoCheckout)) {
    return NextResponse.json({ ...checks, ok: false }, { status: 503 });
  }

  return NextResponse.json(isProduction() ? { ok: true } : checks);
}
