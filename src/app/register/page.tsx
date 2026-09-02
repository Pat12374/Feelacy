import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { registerAction } from "@/lib/actions/auth";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("join") };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  const sp = await searchParams;

  const ERROR_MESSAGES: Record<string, string> = {
    invalid: t("invalidCredentials"),
    rate: t("rateLimited"),
    auth: t("invalidCredentials"),
    email: t("checkEmail"),
  };

  const message =
    sp.error && ERROR_MESSAGES[sp.error]
      ? ERROR_MESSAGES[sp.error]
      : undefined;

  return (
    <div className="wt-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white/55 p-8 shadow-sm">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-[var(--bottle)]">
          {t("joinTitle")}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("joinHint")}</p>
        <form action={registerAction} className="mt-6 grid gap-4">
          <label className="wt-label">
            {t("name")}
            <input className="wt-input" name="name" required minLength={2} maxLength={100} />
          </label>
          <label className="wt-label">
            {t("email")}
            <input className="wt-input" type="email" name="email" required maxLength={254} />
          </label>
          <label className="wt-label">
            {t("password")}
            <input
              className="wt-input"
              type="password"
              name="password"
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          {message && <p className="text-sm text-[var(--danger)]">{message}</p>}
          <button type="submit" className="wt-btn wt-btn-primary">
            {t("createAccount")}
          </button>
        </form>
        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          {t("alreadyRegistered")}{" "}
          <Link href="/login" className="font-semibold text-[var(--bottle)]">
            {tc("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
