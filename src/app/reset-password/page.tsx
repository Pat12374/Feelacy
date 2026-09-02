import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { resetPasswordAction } from "@/lib/actions/auth";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; error?: string }>;
}) {
  const t = await getTranslations("auth");
  const sp = await searchParams;
  const token = sp.token ?? "";
  const email = sp.email ?? "";
  const error =
    sp.error === "invalid"
      ? t("invalidCredentials")
      : sp.error === "expired"
        ? t("resetExpired")
        : sp.error === "rate"
          ? t("rateLimited")
          : undefined;
  const missing = !token || !email;

  return (
    <div className="wt-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white/55 p-8 shadow-sm">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">{t("resetTitle")}</h1>
        {missing || sp.error === "expired" ? (
          <>
            <p className="mt-3 text-sm text-[var(--danger)]">{t("resetExpired")}</p>
            <Link
              href="/forgot-password"
              className="wt-btn wt-btn-primary mt-6 inline-flex"
            >
              {t("requestNewLink")}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {t("setPasswordFor", { email })}
            </p>
            <form action={resetPasswordAction} className="mt-6 grid gap-4">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="email" value={email} />
              <label className="wt-label">
                {t("newPassword")}
                <input
                  className="wt-input"
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
              <label className="wt-label">
                {t("confirmPassword")}
                <input
                  className="wt-input"
                  type="password"
                  name="confirm"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" className="wt-btn wt-btn-primary">
                {t("updatePassword")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
