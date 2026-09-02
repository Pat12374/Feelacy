import {
  allowDemoCheckout,
  authSecret,
  isProduction,
} from "@/lib/security/env";

/**
 * Fail closed on boot for production misconfiguration.
 * Runs once when the Node server starts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const errors: string[] = [];

  if (!authSecret() || authSecret()!.length < 16) {
    errors.push("AUTH_SECRET must be set to a long random string (openssl rand -base64 32).");
  }

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required.");
  }

  if (isProduction()) {
    if (process.env.ALLOW_DEMO_CHECKOUT === "true") {
      errors.push("ALLOW_DEMO_CHECKOUT must not be enabled in production.");
    }
    if (process.env.ALLOW_LOCAL_PLAN_UPGRADE === "true") {
      errors.push("ALLOW_LOCAL_PLAN_UPGRADE must not be enabled in production.");
    }
    if (allowDemoCheckout()) {
      errors.push("Demo checkout is somehow enabled in production.");
    }
    if (process.env.DATABASE_URL?.startsWith("file:")) {
      errors.push("Production must use Postgres (DATABASE_URL cannot be SQLite file:).");
    }
    if (!process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")) {
      errors.push("NEXT_PUBLIC_APP_URL must be an https:// URL in production.");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      errors.push("STRIPE_SECRET_KEY is required in production.");
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      errors.push("STRIPE_WEBHOOK_SECRET is required in production.");
    }
    if (process.env.STRIPE_AUTOMATIC_TAX !== "true") {
      errors.push("STRIPE_AUTOMATIC_TAX must be true in production.");
    }
    if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 24) {
      errors.push("CRON_SECRET must be a strong random value in production.");
    }
    for (const key of ["MEDIA_ENDPOINT", "MEDIA_BUCKET", "MEDIA_PUBLIC_URL", "MEDIA_ACCESS_KEY_ID", "MEDIA_SECRET_ACCESS_KEY"]) {
      if (!process.env[key]) errors.push(`${key} is required in production.`);
    }
    if (!process.env.RESEND_API_KEY) {
      errors.push("RESEND_API_KEY is required in production for welcome and password-reset email.");
    }
    if (!process.env.EMAIL_FROM) {
      errors.push("EMAIL_FROM is required in production (e.g. WineTreff <hello@yourdomain.com>).");
    }
  }

  if (errors.length) {
    const message = `WineTreff launch config invalid:\n- ${errors.join("\n- ")}`;
    if (isProduction()) {
      throw new Error(message);
    }
    console.warn(message);
  }
}
