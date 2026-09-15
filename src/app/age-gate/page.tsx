import { getTranslations } from "next-intl/server";
import { verifyAgeAction } from "@/lib/actions/auth";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_COOKIE } from "@/lib/security/cookies";
import { prisma } from "@/lib/db";

export async function generateMetadata() {
  const t = await getTranslations("age");
  return { title: t("title") };
}

export default async function AgeGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string; error?: string }>;
}) {
  const t = await getTranslations("age");
  const tc = await getTranslations("common");
  const sp = await searchParams;
  const jar = await cookies();
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ageVerificationStatus: true },
      })
    : null;

  if (
    jar.get(AGE_COOKIE)?.value === "1" &&
    user?.ageVerificationStatus === "VERIFIED"
  ) {
    const next =
      sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
        ? sp.next
        : "/search";
    redirect(next);
  }

  const next =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : "/search";

  return (
    <div className="wt-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-white/55 p-8 text-center shadow-sm">
        <p className="font-display text-4xl text-[var(--bottle)]">{tc("brand")}</p>
        <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-[var(--ink-soft)]">{t("body")}</p>
        {sp.status === "processing" && <p className="mt-4 rounded-xl bg-[rgba(184,120,32,.14)] p-4 text-sm">Your document was submitted and Stripe is still processing it. Purchases remain locked until verification completes.</p>}
        {sp.status === "underage" && <p className="mt-4 rounded-xl bg-[rgba(139,38,53,.1)] p-4 text-sm text-[var(--danger)]">We could not confirm that you meet the minimum purchase age. Purchasing and selling remain unavailable.</p>}
        {sp.status === "requires_input" && <p className="mt-4 rounded-xl bg-[rgba(184,120,32,.14)] p-4 text-sm">Stripe needs another document or corrected information. Continue to restart verification.</p>}
        {sp.error && <p className="mt-4 rounded-xl bg-[rgba(139,38,53,.1)] p-4 text-sm text-[var(--danger)]">Identity verification is temporarily unavailable. Please try again later.</p>}
        <form action={verifyAgeAction} className="mt-8">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="wt-btn wt-btn-primary">
            {user?.ageVerificationStatus === "VERIFIED"
              ? "Continue"
              : sp.status === "processing"
                ? "Check verification status"
                : "Verify age with Stripe"}
          </button>
        </form>
      </div>
    </div>
  );
}
