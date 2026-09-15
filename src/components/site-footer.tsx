import Link from "next/link";
import { getTranslations } from "next-intl/server";

const footerLinkClass = "transition-colors hover:text-white focus-visible:text-white";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#315847] bg-[#10291f] text-[#fffaf0]">
      <div className="wt-container flex items-center justify-end gap-5 border-b border-white/15 py-6">
        <Link href="/search" className="shrink-0 text-xs font-semibold text-[#e4bd79] transition-colors hover:text-white sm:text-sm">
          Explore →
        </Link>
      </div>

      <div className="wt-container grid grid-cols-3 gap-x-5 gap-y-7 py-8 lg:gap-x-10">
        <FooterGroup title="Legal">
          <li><Link className={footerLinkClass} href="/legal/terms">{t("nav.terms")}</Link></li>
          <li><Link className={footerLinkClass} href="/legal/privacy">{t("nav.privacy")}</Link></li>
          <li><Link className={footerLinkClass} href="/legal/cookies">Cookie Policy</Link></li>
          <li><Link className={footerLinkClass} href="/legal/policies">Marketplace Policies</Link></li>
          <li><Link className={footerLinkClass} href="/legal/disclaimers">Disclaimers</Link></li>
        </FooterGroup>

        <FooterGroup title="Contact">
          <li><Link className={footerLinkClass} href="/assistant">Customer support</Link></li>
          <li><Link className={footerLinkClass} href="/account">Order support</Link></li>
          <li><Link className={footerLinkClass} href="/sell/onboarding">Seller support</Link></li>
        </FooterGroup>

        <FooterGroup title="Sitemap">
          <li><Link className={footerLinkClass} href="/">Home</Link></li>
          <li><Link className={footerLinkClass} href="/search">{t("nav.searchBottles")}</Link></li>
          <li><Link className={footerLinkClass} href="/search?category=wine">{t("nav.wine")}</Link></li>
          <li><Link className={footerLinkClass} href="/search?category=spirits">{t("nav.spirits")}</Link></li>
          <li><Link className={footerLinkClass} href="/search?category=rare-bottles">{t("nav.rareBottles")}</Link></li>
        </FooterGroup>

        <FooterGroup title="FAQ & Help">
          <li><Link className={footerLinkClass} href="/assistant">Ask WineBloom</Link></li>
          <li><Link className={footerLinkClass} href="/legal/policies">Buying &amp; delivery</Link></li>
          <li><Link className={footerLinkClass} href="/legal/fees">Fees &amp; payments</Link></li>
          <li><Link className={footerLinkClass} href="/age-gate">Age verification</Link></li>
        </FooterGroup>

        <FooterGroup title="Marketplace">
          <li><Link className={footerLinkClass} href="/sell">Sell on WineBloom</Link></li>
          <li><Link className={footerLinkClass} href="/sell/onboarding">{t("nav.becomeSeller")}</Link></li>
          <li><Link className={footerLinkClass} href="/legal/fees">{t("nav.sellerFees")}</Link></li>
          <li><Link className={footerLinkClass} href="/account">Your account</Link></li>
        </FooterGroup>
      </div>

      <div className="border-t border-white/15 py-3 text-center text-[11px] text-[#afc4b7]">
        {t("footer.copyright", { year })}
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title} className="min-w-0 text-[13px]">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e4bd79]">{title}</p>
      <ul className="space-y-1.5 leading-5 text-[#d8e4dc]">{children}</ul>
    </nav>
  );
}
