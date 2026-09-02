import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/commerce/fees";

export async function generateMetadata() {
  const t = await getTranslations("sell");
  return { title: t("listings") };
}

export default async function SellListingsPage() {
  const t = await getTranslations("sell");
  const tf = await getTranslations("footer");
  const { seller } = await requireSeller();
  const listings = await prisma.listing.findMany({
    where: { sellerId: seller.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="bg-[var(--paper)]">
      <div className="wt-container py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div className="max-w-xl">
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
              {t("listings")}
            </h1>
            <p className="mt-3 text-left text-sm leading-relaxed text-[var(--ink-soft)]">
              {tf("tagline")}
            </p>
          </div>
          <Link href="/sell/listings/new" className="wt-btn wt-btn-primary">
            {t("newListing")}
          </Link>
        </div>

        <div className="mt-2">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/sell/listings/${l.id}`}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-4 transition hover:bg-[rgba(20,17,15,0.03)]"
            >
              <div>
                <p className="font-semibold text-[var(--ink)]">{l.title}</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {l.status} · {l.saleType}
                </p>
              </div>
              <p className="font-semibold text-[var(--ink)]">
                {formatEur(l.priceCents)}
              </p>
            </Link>
          ))}
          {listings.length === 0 && (
            <p className="py-8 text-[var(--ink-soft)]">{t("noListings")}</p>
          )}
        </div>

        <Link
          href="/sell"
          className="mt-8 inline-flex text-sm text-[var(--bottle)] hover:underline"
        >
          ← {t("sellerHome")}
        </Link>
      </div>
    </div>
  );
}
