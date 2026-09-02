import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const t = await getTranslations("auth");
  const sp = await searchParams;
  const error =
    sp.error === "rate"
      ? t("rateLimited")
      : sp.error === "email"
        ? t("resetSent")
        : undefined;

  return (
    <div className="wt-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white/55 p-8 shadow-sm">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">{t("forgotTitle")}</h1>
        {sp.sent ? (
          <>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">{t("resetSent")}</p>
            <Link href="/login" className="wt-btn wt-btn-primary mt-6 inline-flex">
              {t("backToSignIn")}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("forgotHint")}</p>
            <form action={requestPasswordResetAction} className="mt-6 grid gap-4">
              <label className="wt-label">
                {t("email")}
                <input
                  className="wt-input"
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                />
              </label>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" className="wt-btn wt-btn-primary">
                {t("sendReset")}
              </button>
            </form>
            <p className="mt-6 text-sm text-[var(--ink-soft)]">
              <Link href="/login" className="font-semibold text-[var(--bottle)]">
                {t("backToSignIn")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
