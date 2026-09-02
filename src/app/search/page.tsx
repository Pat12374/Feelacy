import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { searchListings, type SearchParams } from "@/lib/search";
import { ListingCard } from "@/components/listing-card";
import { VoiceSearchInput } from "@/components/voice-search-input";
import { marketplaceCategory } from "@/lib/marketplace-categories";
import { FulfillmentSearchControls } from "@/components/fulfillment-search-controls";

export async function generateMetadata() {
  const t = await getTranslations("search");
  return { title: t("title") };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("search");
  const locale = await getLocale();
  const params = await searchParams;
  const result = await searchListings(params);
  const selectedCategory = marketplaceCategory(params.category);
  const activeCategory = selectedCategory?.label ?? "All categories";

  function hrefFor(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { ...params, ...overrides, page: overrides.page ?? "1" };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, String(v));
    });
    return `/search?${sp.toString()}`;
  }

  return (
    <div className="wt-container py-10">
      <div className="mb-8">
        <h1 className="font-sans text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 font-display text-2xl capitalize text-[var(--bottle)]">
          {activeCategory}
        </p>
        {selectedCategory && <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">{selectedCategory.description}</p>}
      </div>

      <form className="mb-8 grid gap-3 rounded-2xl border border-[var(--line)] bg-white/45 p-4 md:grid-cols-6">
        <label className="wt-label md:col-span-2">
          {t("query")}
          <VoiceSearchInput
            defaultValue={params.q ?? ""}
            locale={locale}
            placeholder={t("queryPlaceholder")}
            startLabel={t("voiceStart")}
            stopLabel={t("voiceStop")}
            listeningLabel={t("voiceListening")}
            unsupportedLabel={t("voiceUnsupported")}
            errorLabel={t("voiceError")}
          />
        </label>
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <FulfillmentSearchControls fulfillmentType={params.fulfillmentType} latitude={params.latitude} longitude={params.longitude} radiusMiles={params.radiusMiles} />
        <label className="wt-label">
          {t("minPrice")}
          <input
            className="wt-input"
            name="minPrice"
            type="number"
            min={0}
            step="1"
            defaultValue={params.minPrice ?? ""}
          />
        </label>
        <label className="wt-label">
          {t("sort")}
          <select className="wt-select" name="sort" defaultValue={params.sort ?? ""}>
            <option value="">{t("recommended")}</option>
            <option value="price_asc">{t("priceAsc")}</option>
            <option value="price_desc">{t("priceDesc")}</option>
            <option value="promo">{t("promoted")}</option>
          </select>
        </label>
        <div className="md:col-span-6">
          <button type="submit" className="wt-btn wt-btn-primary">
            {t("apply")}
          </button>
        </div>
      </form>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {result.listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      {result.listings.length === 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-white/45 p-8 text-center">
          <h2 className="font-display text-2xl">No {activeCategory.toLowerCase()} available</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">No active seller offers match these filters or pickup radius. Try clearing the text, price, vintage, or location filters.</p>
          <Link href={selectedCategory?.href ?? "/search"} className="wt-btn wt-btn-secondary mt-5">Clear filters</Link>
        </div>
      )}

      {result.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          {result.page > 1 && (
            <Link
              className="wt-btn wt-btn-secondary"
              href={hrefFor({ page: String(result.page - 1) })}
            >
              {t("previous")}
            </Link>
          )}
          <span className="text-sm text-[var(--ink-soft)]">
            {t("page", { page: result.page, total: result.totalPages })}
          </span>
          {result.page < result.totalPages && (
            <Link
              className="wt-btn wt-btn-secondary"
              href={hrefFor({ page: String(result.page + 1) })}
            >
              {t("next")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
