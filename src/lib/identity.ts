import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const MINIMUM_PURCHASE_AGE = 18;

export function isAtLeastAge(
  dob: { day: number; month: number; year: number },
  minimumAge = MINIMUM_PURCHASE_AGE,
  now = new Date(),
): boolean {
  const cutoffYear = now.getUTCFullYear() - minimumAge;
  const cutoffMonth = now.getUTCMonth() + 1;
  const cutoffDay = now.getUTCDate();

  return (
    dob.year < cutoffYear ||
    (dob.year === cutoffYear &&
      (dob.month < cutoffMonth ||
        (dob.month === cutoffMonth && dob.day <= cutoffDay)))
  );
}

/** Store only eligibility state, never Stripe's identity outputs or document data. */
export async function applyStripeIdentityResult(
  verification: Stripe.Identity.VerificationSession,
): Promise<"VERIFIED" | "UNDERAGE" | "PROCESSING" | "REQUIRES_INPUT"> {
  const user = await prisma.user.findUnique({
    where: { stripeIdentityVerificationId: verification.id },
    select: { id: true },
  });
  if (!user) return "REQUIRES_INPUT";

  if (verification.status === "verified") {
    const dob = verification.verified_outputs?.dob;
    const eligible = Boolean(
      dob?.day != null &&
        dob.month != null &&
        dob.year != null &&
        isAtLeastAge({ day: dob.day, month: dob.month, year: dob.year }),
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ageVerificationStatus: eligible ? "VERIFIED" : "UNDERAGE",
        ageVerifiedAt: eligible ? new Date() : null,
      },
    });
    return eligible ? "VERIFIED" : "UNDERAGE";
  }

  const status =
    verification.status === "processing" ? "PROCESSING" : "REQUIRES_INPUT";
  await prisma.user.update({
    where: { id: user.id },
    data: { ageVerificationStatus: status, ageVerifiedAt: null },
  });
  return status;
}

export async function retrieveAndApplyStripeIdentityResult(
  verificationId: string,
) {
  const verification = await getStripe().identity.verificationSessions.retrieve(
    verificationId,
    { expand: ["verified_outputs.dob"] },
  );
  return applyStripeIdentityResult(verification);
}
