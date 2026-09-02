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
    seller: { displayName: string; slug: string };
    region?: { name: string } | null;
    distanceMiles?: number;
  };
};

export function ListingCard({ listing }: ListingCardProps) {
  const image = listing.images[0];
  return (
    <Link href={`/listings/${listing.slug}`} className="wt-card-listing">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          image?.url ??
          "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80"
        }
        alt={image?.alt ?? listing.title}
      />
      <div className="grid gap-1">
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
