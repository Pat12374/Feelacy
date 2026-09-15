"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { AuthError } from "next-auth";
import type Stripe from "stripe";
import { z } from "zod";
import { cookies, headers } from "next/headers";
import { signIn, signOut, auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLAN_DEFAULTS } from "@/lib/commerce/fees";
import { slugify } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AGE_COOKIE } from "@/lib/security/cookies";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  clientIpFromHeaders,
  rateLimit,
} from "@/lib/security/rate-limit";
import { isProduction } from "@/lib/security/env";
import {
  appUrl,
  passwordResetEmail,
  sendEmail,
  welcomeEmail,
} from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function registerAction(formData: FormData): Promise<void> {
  const ip = clientIpFromHeaders(await headers());
  const limited = rateLimit({
    key: `register:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) redirect("/register?error=rate");

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/register?error=invalid");
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  // Avoid email enumeration: same redirect path whether or not the email exists.
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        role: "BUYER",
      },
    });

    const welcome = welcomeEmail({
      name: user.name ?? "there",
      email: user.email,
    });
    try {
      await sendEmail({
        to: user.email,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
      });
    } catch (err) {
      console.error("[register] welcome email failed:", err);
      // Account remains; email is retried operationally. Do not block join.
    }

    try {
      await signIn("credentials", {
        email,
        password: parsed.data.password,
        redirectTo: "/age-gate",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=auth");
      throw e;
    }
  }

  // Existing email: generic success-style redirect to login (no "exists" signal)
  redirect("/login?error=check");
}

export async function loginAction(formData: FormData): Promise<void> {
  const ip = clientIpFromHeaders(await headers());
  const email = String(formData.get("email") ?? "").toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 128);
  const requestedNext = String(formData.get("next") ?? "");
  const redirectTo =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/search";

  const limited = rateLimit({
    key: `login:${ip}:${email}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) redirect("/login?error=rate");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(`/login?error=auth&next=${encodeURIComponent(redirectTo)}`);
    }
    throw e;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<void> {
  const ip = clientIpFromHeaders(await headers());
  const limited = rateLimit({
    key: `forgot:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) redirect("/forgot-password?error=rate");

  const emailRaw = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim()
    .slice(0, 254);
  const parsed = z.string().email().safeParse(emailRaw);
  // Always show the same success screen to avoid account enumeration
  if (!parsed.success) redirect("/forgot-password?sent=1");

  const email = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.passwordHash) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const identifier = `password-reset:${email}`;
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    });

    const resetUrl = `${appUrl()}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
    const mail = passwordResetEmail({
      name: user.name ?? "there",
      email,
      resetUrl,
    });

    try {
      await sendEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } catch (err) {
      console.error("[forgot-password] email failed:", err);
      if (isProduction()) redirect("/forgot-password?error=email");
    }
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const ip = clientIpFromHeaders(await headers());
  const limited = rateLimit({
    key: `reset:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) redirect("/reset-password?error=rate");

  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim()
    .slice(0, 254);
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const schema = z.object({
    email: z.string().email(),
    token: z.string().min(20),
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse({ email, token, password, confirm });
  if (!parsed.success || password !== confirm) {
    redirect(
      `/reset-password?error=invalid&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
    );
  }

  const identifier = `password-reset:${email}`;
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: { identifier, token: tokenHash },
    },
  });

  if (!record || record.expires.getTime() < Date.now()) {
    redirect("/reset-password?error=expired");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/reset-password?error=expired");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token: tokenHash } },
    }),
  ]);

  redirect("/login?error=reset");
}

export async function verifyAgeAction(formData?: FormData): Promise<void> {
  const session = await auth();
  const next = String(formData?.get("next") ?? "/search");
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/search";

  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/age-gate?next=${safeNext}`)}`);
  }
  const ip = clientIpFromHeaders(await headers());
  const limited = rateLimit({
    key: `identity:${session.user.id}:${ip}`,
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!limited.ok) {
    redirect(`/age-gate?error=rate&next=${encodeURIComponent(safeNext)}`);
  }
  if (!isStripeConfigured()) {
    redirect(
      `/age-gate?error=unavailable&next=${encodeURIComponent(safeNext)}`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      ageVerificationStatus: true,
      stripeIdentityVerificationId: true,
    },
  });
  if (!user) redirect("/login");

  if (user.ageVerificationStatus === "VERIFIED") {
    const jar = await cookies();
    jar.set(AGE_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(safeNext);
  }

  let verification: Stripe.Identity.VerificationSession | null = null;
  if (user.stripeIdentityVerificationId) {
    verification = await getStripe().identity.verificationSessions.retrieve(
      user.stripeIdentityVerificationId,
    );
  }

  if (
    !verification ||
    !["requires_input", "processing"].includes(verification.status)
  ) {
    const returnUrl = new URL(
      `/api/identity/return?next=${encodeURIComponent(safeNext)}`,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ).toString();
    verification = await getStripe().identity.verificationSessions.create(
      {
        type: "document",
        client_reference_id: session.user.id,
        provided_details: { email: user.email },
        return_url: returnUrl,
      },
      {
        idempotencyKey: `age-verification-${session.user.id}-${user.stripeIdentityVerificationId ?? "initial"}`,
      },
    );
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        stripeIdentityVerificationId: verification.id,
        ageVerificationStatus: "REQUIRES_INPUT",
        ageVerifiedAt: null,
      },
    });
  }

  if (verification.status === "processing") {
    redirect(
      `/age-gate?status=processing&next=${encodeURIComponent(safeNext)}`,
    );
  }
  if (!verification.url) {
    redirect(
      `/age-gate?error=unavailable&next=${encodeURIComponent(safeNext)}`,
    );
  }
  redirect(verification.url);
}

const sellerOnboardSchema = z.object({
  displayName: z.string().min(2).max(80),
  bio: z.string().max(2000).optional(),
  region: z.string().max(80).optional(),
  country: z.string().min(2).max(2).default("DE"),
});

export async function createSellerProfileAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ageVerifiedAt: true, ageVerificationStatus: true },
  });
  if (!user?.ageVerifiedAt || user.ageVerificationStatus !== "VERIFIED") {
    redirect("/age-gate");
  }

  const parsed = sellerOnboardSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    region: formData.get("region") || undefined,
    country: formData.get("country") || "DE",
  });
  if (!parsed.success) redirect("/sell/onboarding?error=invalid");

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) redirect("/sell");

  const starter = await prisma.sellerPlan.findUnique({ where: { code: "STARTER" } });
  if (!starter) redirect("/sell/onboarding?error=plans");

  let slug = slugify(parsed.data.displayName);
  const clash = await prisma.sellerProfile.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${session.user.id.slice(-4)}`;

  await prisma.$transaction([
    prisma.sellerProfile.create({
      data: {
        userId: session.user.id,
        displayName: parsed.data.displayName,
        slug,
        bio: parsed.data.bio,
        region: parsed.data.region,
        country: parsed.data.country,
        planId: starter.id,
        commissionBps: PLAN_DEFAULTS.STARTER.commissionBps,
        subscription: {
          create: { status: "ACTIVE" },
        },
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { role: "SELLER" },
    }),
  ]);

  revalidatePath("/sell");
  redirect("/sell");
}
