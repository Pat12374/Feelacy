import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireAgeVerified() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ageVerifiedAt: true, role: true },
  });
  if (!user?.ageVerifiedAt) redirect("/age-gate");
  return session;
}

export async function requireSeller() {
  const session = await requireAgeVerified();
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { plan: true, subscription: true },
  });
  if (!seller) redirect("/sell/onboarding");
  return { session, seller };
}

/** Always re-check ADMIN from the database — never trust JWT alone */
export async function requireAdmin() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/");
  return session;
}
