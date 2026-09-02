import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--paper)]">
      <div className="wt-container grid gap-8 py-10 sm:grid-cols-2">
        <div className="text-sm">
          <p className="mb-3 font-semibold">{t("nav.explore")}</p>
          <ul className="space-y-2 text-[var(--ink-soft)]">
            <li>
              <Link href="/search">{t("nav.searchBottles")}</Link>
            </li>
            <li>
              <Link href="/search?category=wine">{t("nav.wine")}</Link>
            </li>
            <li>
              <Link href="/search?category=spirits">{t("nav.spirits")}</Link>
            </li>
            <li>
              <Link href="/search?category=rare-bottles">{t("nav.rareBottles")}</Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">{t("nav.trust")}</p>
          <ul className="space-y-2 text-[var(--ink-soft)]">
            <li>
              <Link href="/legal/fees">{t("nav.sellerFees")}</Link>
            </li>
            <li>
              <Link href="/legal/terms">{t("nav.terms")}</Link>
            </li>
            <li>
              <Link href="/legal/privacy">{t("nav.privacy")}</Link>
            </li>
            <li>
              <Link href="/sell/onboarding">{t("nav.becomeSeller")}</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--line)] py-4 text-center text-xs text-[var(--ink-soft)]">
        {t("footer.copyright", { year })}
      </div>
    </footer>
  );
}
