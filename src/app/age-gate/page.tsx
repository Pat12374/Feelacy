import { getTranslations } from "next-intl/server";
import { verifyAgeAction } from "@/lib/actions/auth";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_COOKIE } from "@/lib/security/cookies";

export async function generateMetadata() {
  const t = await getTranslations("age");
  return { title: t("title") };
}

export default async function AgeGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("age");
  const tc = await getTranslations("common");
  const sp = await searchParams;
  const jar = await cookies();
  const session = await auth();

  if (jar.get(AGE_COOKIE)?.value === "1") {
    if (session?.user?.id && !session.user.ageVerifiedAt) {
      // Cookie present but account not stamped — still show gate to stamp DB
    } else {
      const next =
        sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
          ? sp.next
          : "/search";
      redirect(next);
    }
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
        <form action={verifyAgeAction} className="mt-8">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="wt-btn wt-btn-primary">
            {t("confirm")}
          </button>
        </form>
      </div>
    </div>
  );
}
