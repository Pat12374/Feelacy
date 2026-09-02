import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loginAction } from "@/lib/actions/auth";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("signIn") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  const sp = await searchParams;

  const ERROR_MESSAGES: Record<string, string> = {
    auth: t("invalidCredentials"),
    rate: t("rateLimited"),
    check: t("checkEmail"),
    reset: t("passwordUpdated"),
  };

  const message =
    sp.error && ERROR_MESSAGES[sp.error]
      ? ERROR_MESSAGES[sp.error]
      : undefined;

  return (
    <div className="wt-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white/55 p-8 shadow-sm">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">{t("welcomeBack")}</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("signInHint")}</p>
        <form action={loginAction} className="mt-6 grid gap-4">
          <input
            type="hidden"
            name="next"
            value={sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/search"}
          />
          <label className="wt-label">
            {t("email")}
            <input className="wt-input" type="email" name="email" required />
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
          {message && (
            <p
              className={`text-sm ${sp.error === "reset" || sp.error === "check" ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}
            >
              {message}
            </p>
          )}
          <button type="submit" className="wt-btn wt-btn-primary">
            {tc("signIn")}
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-[var(--bottle)]"
          >
            {t("forgotPassword")}
          </Link>
        </p>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          {t("newHere")}{" "}
          <Link href="/register" className="font-semibold text-[var(--bottle)]">
            {t("createAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}
