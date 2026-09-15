import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing-card";
import { VoiceSearchInput } from "@/components/voice-search-input";
import { demoListingImages } from "@/lib/demo-listing-images";

type FeaturedListing = Prisma.ListingGetPayload<{
  include: {
    images: true;
    seller: { select: { displayName: true; slug: true } };
    region: true;
    category: true;
  };
}>;

const homepageBrandSlugs = [
  "mosel-vale-riesling-spatlese-2018",
  "chateau-exemplar-pauillac-2015",
  "highland-cask-speyside-18",
  "maison-celeste-blanc-de-blancs",
];

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("search");
  const locale = await getLocale();

  let featured: FeaturedListing[] = [];
  
  try {
    featured = await prisma.listing.findMany({
      where: { status: "ACTIVE", slug: { in: homepageBrandSlugs } },
      take: 4,
      orderBy: [{ promoRank: "desc" }, { createdAt: "desc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        seller: { select: { displayName: true, slug: true } },
        region: true,
        category: true,
      },
    });
  } catch (error) {
    console.error("Failed to fetch featured listings:", error);
    // Return empty array to allow page to render
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--line)] bg-[linear-gradient(135deg,#fffdf8_0%,#fff7e9_55%,#f8e8d2_100%)]">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-[rgba(184,120,32,.10)] blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[rgba(115,21,33,.10)] blur-3xl" />
        <div className="wt-container grid items-center gap-10 py-10 sm:py-14 lg:min-h-[660px] lg:grid-cols-[1.06fr_.94fr] lg:gap-16 lg:py-16">
          <div className="wt-rise relative z-10">
            <h1 className="font-display text-5xl leading-[0.95] tracking-[-0.035em] text-[var(--ink)] sm:text-6xl lg:text-7xl">
              {t("welcome")}
            </h1>
            <p className="mt-3 font-display text-xl text-[var(--bottle)] sm:text-2xl">
              For Every Occasion.
            </p>
            <p className="mt-5 max-w-2xl font-display text-4xl leading-[1.04] tracking-[-0.025em] text-[var(--ink)] sm:text-5xl lg:text-[3.75rem]">
              {t("headline")}
            </p>
            <form
              action="/search"
              className="wt-rise mt-8 rounded-2xl border border-[rgba(184,120,32,.28)] bg-white p-3 shadow-[0_20px_55px_rgba(115,21,33,0.10)] sm:flex sm:items-end sm:gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <label className="grid w-full gap-1.5 px-1 text-sm font-medium text-[var(--ink-soft)]">
                {ts("query")}
                <VoiceSearchInput
                  defaultValue=""
                  locale={locale}
                  placeholder={t("searchPlaceholder")}
                  startLabel={ts("voiceStart")}
                  stopLabel={ts("voiceStop")}
                  listeningLabel={ts("voiceListening")}
                  unsupportedLabel={ts("voiceUnsupported")}
                  errorLabel={ts("voiceError")}
                  className="w-full"
                  inputClassName="!rounded-xl !border-[var(--line)] !bg-[var(--paper)] !text-[var(--ink)]"
                />
              </label>
              <button type="submit" className="wt-btn wt-btn-primary mt-3 w-full whitespace-nowrap !bg-[#1f4d3a] hover:!bg-[#173b2d] sm:mt-0 sm:w-auto">
                {t("searchCta")}
              </button>
            </form>
          </div>

          <div className="wt-rise relative mx-auto w-full max-w-xl lg:max-w-none" style={{ animationDelay: "120ms" }}>
            <div className="absolute -left-6 -top-6 h-40 w-40 rounded-full bg-[rgba(213,166,83,.22)] blur-2xl" />
            <div className="absolute -bottom-10 -right-8 h-52 w-52 rounded-full bg-[rgba(115,21,33,.15)] blur-3xl" />
            <div
              className="relative min-h-[390px] overflow-hidden rounded-[1.5rem] border-4 border-white bg-cover bg-center shadow-[0_28px_80px_rgba(115,21,33,.18)] sm:min-h-[520px]"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(23,59,46,0.03), rgba(75,9,17,0.20)), url(/feelacy-wine-bouquet-hero.jpg)",
              }}
              role="img"
              aria-label="Wine bottles arranged around an elegant floral bouquet"
            />
            <div className="absolute -bottom-5 left-5 max-w-[calc(100%_-_2.5rem)] rounded-xl border border-[rgba(184,120,32,.32)] bg-[rgba(255,250,241,.96)] px-5 py-4 shadow-xl backdrop-blur sm:left-8">
              <p className="font-display text-xl text-[var(--bottle)]">{t("freshTitle")}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{t("freshSubtitle")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,rgba(255,255,255,.58),rgba(255,250,241,.72))]">
        <div className="wt-container py-16 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[var(--copper)]">Selection</p>
            <h2 className="font-display text-3xl text-[var(--bottle)] sm:text-4xl">{t("freshTitle")}</h2>
            <p className="mt-2 text-[var(--ink-soft)]">{t("freshSubtitle")}</p>
          </div>
          <Link href="/search" className="wt-btn wt-btn-secondary text-sm">
            {tc("viewAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {featured.map((listing) => (
            <ListingCard
              key={listing.id}
              compact
              showWineImages
              listing={{
                ...listing,
                images: [{ url: demoListingImages[listing.slug], alt: listing.title }],
              }}
            />
          ))}
        </div>
        {featured.length === 0 && (
          <p className="rounded-2xl border border-[var(--line)] bg-white p-8 text-[var(--ink-soft)] shadow-sm">
            {t("empty")}{" "}
            <Link href="/sell/onboarding" className="underline">
              {tn("becomeSeller")}
            </Link>
          </p>
        )}
        </div>
      </section>
    </>
  );
}
