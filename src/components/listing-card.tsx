import Link from "next/link";
import { formatEur } from "@/lib/commerce/fees";

type ListingCardProps = {
  listing: {
    slug: string;
    title: string;
    priceCents: number;
    vintage?: number | null;
    condition?: string | null;
    images: { url: string; alt?: string | null }[];
    category?: { slug: string } | null;
    seller: { displayName: string; slug: string };
    region?: { name: string } | null;
    distanceMiles?: number;
  };
  compact?: boolean;
  showWineImages?: boolean;
  hideImages?: boolean;
  horizontal?: boolean;
};

export function ListingCard({
  listing,
  compact = false,
  showWineImages = false,
  hideImages = false,
  horizontal = false,
}: ListingCardProps) {
  const image = listing.images[0];
  const showImage = !hideImages && Boolean(image) && (listing.category?.slug !== "wine" || showWineImages);
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className={`wt-card-listing ${horizontal ? "!grid-cols-[minmax(0,1fr)_7.5rem] rounded-2xl border border-[var(--line)] bg-white/55 p-4 sm:!grid-cols-[minmax(0,1fr)_9rem]" : ""}`}
    >
      {showImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image!.url}
          alt={image?.alt ?? listing.title}
          className={horizontal ? "order-2 !h-full !min-h-32 !aspect-auto" : compact ? "!aspect-[4/3]" : undefined}
        />
      )}
      <div className={`grid gap-1 ${horizontal ? "order-1 content-center" : showImage ? "" : "min-h-52 content-end rounded-2xl border border-[var(--line)] bg-[rgba(31,61,50,.07)] p-6"} ${compact && !horizontal ? "px-1" : ""}`}>
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--copper)]">
          {listing.region?.name ?? "Collection"}
          {listing.vintage ? ` · ${listing.vintage}` : ""}
        </p>
        <h3 className="font-display text-xl leading-snug">{listing.title}</h3>
        <p className="text-sm text-[var(--ink-soft)]">
          {listing.seller.displayName}
          {listing.condition ? ` · ${listing.condition}` : ""}
        </p>
        <p className="mt-1 text-lg font-semibold">{formatEur(listing.priceCents)}</p>
        {listing.distanceMiles != null && <p className="text-sm font-semibold text-[var(--bottle)]">Pickup {listing.distanceMiles.toFixed(1)} miles away</p>}
      </div>
    </Link>
  );
}
