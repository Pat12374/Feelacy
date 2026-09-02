import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing-card";
import { VoiceSearchInput } from "@/components/voice-search-input";

type FeaturedListing = Prisma.ListingGetPayload<{
  include: {
    images: true;
    seller: { select: { displayName: true; slug: true } };
    region: true;
  };
}>;

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("search");
  const locale = await getLocale();

  let featured: FeaturedListing[] = [];
  
  try {
    featured = await prisma.listing.findMany({
      where: { status: "ACTIVE" },
      take: 8,
      orderBy: [{ promoRank: "desc" }, { createdAt: "desc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        seller: { select: { displayName: true, slug: true } },
        region: true,
      },
    });
  } catch (error) {
    console.error("Failed to fetch featured listings:", error);
    // Return empty array to allow page to render
  }

  return (
    <>
      <section className="relative min-h-[88vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(105deg, rgba(20,17,15,0.72) 8%, rgba(20,17,15,0.35) 48%, rgba(20,17,15,0.2) 100%), url(https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=2000&q=80)",
          }}
        />
        <h1 className="wt-rise absolute inset-x-4 top-[8%] z-10 text-center font-sans text-[39px] font-semibold leading-[1.05] tracking-tight text-[var(--paper)] drop-shadow-lg sm:text-[51px] md:text-[63px]">
          {t("welcome")}
        </h1>
        <div className="wt-container relative flex min-h-[88vh] flex-col pb-16 pt-[16vh] text-[var(--paper)]">
          <p className="wt-rise max-w-2xl font-sans text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--paper)] sm:text-5xl md:text-6xl">
            {t("headline")}
          </p>
          <form
            action="/search"
            className="wt-rise mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "220ms" }}
          >
            <label className="grid w-full gap-1.5 text-sm font-medium text-[var(--paper)]">
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
                inputClassName="!rounded-full !border-0 !bg-[rgba(243,239,230,0.95)] !text-[var(--ink)] shadow-lg"
              />
            </label>
            <button type="submit" className="wt-btn wt-btn-primary whitespace-nowrap sm:self-end">
              {t("searchCta")}
            </button>
          </form>
        </div>
      </section>

      <section className="wt-container py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl">{t("freshTitle")}</h2>
            <p className="mt-2 text-[var(--ink-soft)]">{t("freshSubtitle")}</p>
          </div>
          <Link href="/search" className="wt-btn wt-btn-secondary text-sm">
            {tc("viewAll")}
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        {featured.length === 0 && (
          <p className="rounded-2xl border border-[var(--line)] bg-white/40 p-8 text-[var(--ink-soft)]">
            {t("empty")}{" "}
            <Link href="/sell/onboarding" className="underline">
              {tn("becomeSeller")}
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
