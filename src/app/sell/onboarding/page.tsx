import { getTranslations } from "next-intl/server";
import { createSellerProfileAction } from "@/lib/actions/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("becomeSeller") };
}

export default async function SellerOnboardingPage() {
  const t = await getTranslations("sell");
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.ageVerifiedAt) redirect("/age-gate");

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) redirect("/sell");

  return (
    <div className="wt-container py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/55 p-8">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">{t("openShop")}</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("openShopHint")}</p>
        <form action={createSellerProfileAction} className="mt-6 grid gap-4">
          <label className="wt-label">
            {t("shopName")}
            <input className="wt-input" name="displayName" required minLength={2} />
          </label>
          <label className="wt-label">
            {t("region")}
            <input className="wt-input" name="region" placeholder="Mosel, Speyside…" />
          </label>
          <label className="wt-label">
            {t("country")}
            <input className="wt-input" name="country" defaultValue="DE" maxLength={2} />
          </label>
          <label className="wt-label">
            {t("bio")}
            <textarea className="wt-textarea" name="bio" />
          </label>
          <button type="submit" className="wt-btn wt-btn-primary">
            {t("createSeller")}
          </button>
        </form>
      </div>
    </div>
  );
}
