import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import {
  buildSettlementPreview,
  formatBpsAsPercent,
  formatEur,
} from "@/lib/commerce/fees";
import { auth } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await prisma.listing.findUnique({ where: { slug } });
  return { title: listing?.title ?? "Listing" };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getTranslations("listing");
  const ts = await getTranslations("sell");
  const { slug } = await params;
  const session = await auth();
  const listing = await prisma.listing.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      seller: { include: { plan: true } },
      category: true,
      region: true,
      producer: true,
    },
  });
  if (
    !listing ||
    (listing.status !== "ACTIVE" && session?.user?.role !== "ADMIN")
  ) {
    notFound();
  }

  const preview = buildSettlementPreview({
    productSubtotalCents: listing.priceCents,
    shippingCents: listing.shippingCents,
    commissionBps: listing.seller.commissionBps,
  });

  const isSellerOwner = session?.user?.id === listing.seller.userId;
  const isAdmin = session?.user?.role === "ADMIN";
  const showSettlement = isSellerOwner || isAdmin;

  const image =
    listing.images[0]?.url ??
    "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1400&q=80";

  return (
    <div className="wt-container py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[1.5rem] bg-[var(--paper-deep)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={listing.title}
            className="aspect-[4/5] w-full object-cover transition duration-700 hover:scale-[1.02]"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--copper)]">
            {[listing.category?.name, listing.region?.name, listing.vintage]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="mt-3 font-sans text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {listing.title}
          </h1>
          <p className="mt-3 text-[var(--ink-soft)]">
            {t("soldBy")}{" "}
            <Link
              href={`/merchants/${listing.seller.slug}`}
              className="font-semibold text-[var(--bottle)] underline-offset-2 hover:underline"
            >
              {listing.seller.displayName}
            </Link>
          </p>

          <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/50 p-5">
            <p className="font-display text-4xl">
              {formatEur(listing.priceCents)}
            </p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {t("shipping", { amount: formatEur(listing.shippingCents) })} ·{" "}
              {t("taxesHint")}
            </p>
            <p className="mt-3 text-sm font-medium text-[var(--ok)]">
              {t("noBuyerFees")}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              {t("yourTotal", { amount: formatEur(preview.buyerTotalCents) })}
            </p>

            {listing.status === "ACTIVE" ? (
              session?.user ? (
                <Link href={`/checkout/${listing.id}`} className="wt-btn wt-btn-primary mt-5 inline-flex w-full sm:w-auto">{t("buyNow")}</Link>
              ) : (
                <Link
                  href="/login"
                  className="wt-btn wt-btn-primary mt-5 inline-flex"
                >
                  {t("signInToBuy")}
                </Link>
              )
            ) : (
              <p className="mt-5 text-sm text-[var(--danger)]">{t("notAvailable")}</p>
            )}
          </div>

          <div className="mt-8 grid gap-4 text-sm">
            <Spec label={t("condition")} value={listing.condition} />
            <Spec label={t("fillLevel")} value={listing.fillLevel} />
            <Spec label={t("label")} value={listing.labelCondition} />
            <Spec
              label={t("bottle")}
              value={
                listing.bottleSizeMl ? `${listing.bottleSizeMl} ml` : null
              }
            />
            <Spec label={t("abv")} value={listing.abv ? `${listing.abv}%` : null} />
            <Spec label={t("producer")} value={listing.producer?.name} />
            <Spec label={t("saleType")} value={t("fixedPrice")} />
          </div>
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <h2 className="font-display text-2xl">{t("about")}</h2>
          <p className="mt-4 whitespace-pre-wrap leading-relaxed text-[var(--ink-soft)]">
            {listing.description}
          </p>
          {listing.tastingNotes && (
            <>
              <h3 className="mt-8 font-display text-xl">{t("tastingNotes")}</h3>
              <p className="mt-3 text-[var(--ink-soft)]">{listing.tastingNotes}</p>
            </>
          )}
        </div>
        {showSettlement && (
          <aside className="rounded-2xl border border-[var(--line)] bg-[rgba(31,61,50,0.06)] p-5 text-sm">
            <h3 className="font-semibold">{ts("settlementFormula")}</h3>
            <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
              <li>
                WineTreff ({formatBpsAsPercent(listing.seller.commissionBps)}):{" "}
                {formatEur(preview.commissionAmountCents)}
              </li>
              <li>
                {formatEur(preview.processorFeeEstimatedCents)}
              </li>
              <li>
                {formatEur(preview.sellerPayoutEstimatedCents)}
              </li>
            </ul>
          </aside>
        )}
      </section>
    </div>
  );
}

function Spec({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
