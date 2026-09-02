/** Environment-gated security switches */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Unpaid demo checkout — local only, never in production */
export function allowDemoCheckout(): boolean {
  if (isProduction()) return false;
  return process.env.ALLOW_DEMO_CHECKOUT === "true";
}

export function authSecret(): string | undefined {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
}

export function assertAuthSecretConfigured(): void {
  if (!authSecret()) {
    throw new Error(
      "AUTH_SECRET is not configured. Set a long random value in .env (see .env.example).",
    );
  }
}
