import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace-categories";

export async function SiteHeader() {
  const session = await auth();
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(255,250,241,.94)] backdrop-blur-xl">
      <div className="wt-container flex h-16 items-center gap-3 sm:h-20">
        <Link
          href="/"
          className="flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16"
          aria-label="WineBloom — For Every Occasion."
        >
          <Image
            src="/winebloom-logo.png"
            alt="WineBloom — For Every Occasion."
            width={64}
            height={64}
            className="h-full w-full object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--ink-soft)] md:ml-auto md:flex">
          <Link href="/search" className="hover:text-[var(--ink)]">
            {t("search")}
          </Link>
          <Link href="/legal/fees" className="hover:text-[var(--ink)]">
            {t("fees")}
          </Link>
          <Link href="/sell" className="hover:text-[var(--ink)]">
            {t("sell")}
          </Link>
          <Link href="/assistant" className="hover:text-[var(--ink)]">AI Assistant</Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 md:ml-0">
          <LanguageSwitcher current={locale} label={t("language")} />
          {session?.user ? (
            <>
              <Link
                href="/account"
                className="hidden max-w-[8rem] truncate text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] lg:inline"
              >
                {session.user.name ?? session.user.email}
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="wt-btn wt-btn-secondary text-sm !py-2">
                  {t("admin")}
                </Link>
              )}
              <form action={logoutAction}>
                <button type="submit" className="wt-btn wt-btn-secondary text-sm !py-2">
                  {t("signOut")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="wt-btn wt-btn-secondary text-sm !py-2">
                {t("signIn")}
              </Link>
              <Link href="/register" className="wt-btn wt-btn-primary !bg-[#1f4d3a] text-sm !py-2 hover:!bg-[#173b2d]">
                {t("join")}
              </Link>
            </>
          )}
        </div>
      </div>
      <nav
        aria-label="Marketplace categories"
        className="border-t border-[var(--line)] bg-white/25"
      >
        <div className="wt-container flex items-center justify-start gap-5 overflow-x-auto py-2 text-sm font-semibold text-[var(--ink-soft)] sm:justify-center sm:gap-8 md:overflow-visible">
          {MARKETPLACE_CATEGORIES.filter(category => category.slug !== "accessories").map((category) =>
            category.slug === "wine" ? (
              <div key={category.href} className="group relative shrink-0">
                <Link
                  href={category.href}
                  className="inline-flex items-center gap-1 py-1 hover:text-[var(--bottle)]"
                  aria-haspopup="true"
                >
                  Wines
                </Link>
                <div className="invisible absolute left-1/2 top-full z-50 w-44 -translate-x-1/2 translate-y-1 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <Link href="/wines/white" className="block rounded-xl px-4 py-2.5 hover:bg-white/70 hover:text-[var(--bottle)]">White Wines</Link>
                  <Link href="/wines/red" className="block rounded-xl px-4 py-2.5 hover:bg-white/70 hover:text-[var(--bottle)]">Red Wines</Link>
                  <Link href="/wines/other" className="block rounded-xl px-4 py-2.5 hover:bg-white/70 hover:text-[var(--bottle)]">Other Wines</Link>
                </div>
              </div>
            ) : (
              <Link key={category.href} href={category.href} className="shrink-0 hover:text-[var(--bottle)]">
                {category.label}
              </Link>
            ),
          )}
        </div>
      </nav>
    </header>
  );
}
