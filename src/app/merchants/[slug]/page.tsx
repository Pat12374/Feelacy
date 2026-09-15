import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await prisma.sellerProfile.findUnique({ where: { slug } });
  return { title: merchant?.displayName ?? "Merchant" };
}

export default async function MerchantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await prisma.sellerProfile.findUnique({
    where: { slug },
    include: {
      plan: true,
      listings: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          seller: { select: { displayName: true, slug: true } },
          region: true,
          category: true,
        },
      },
    },
  });
  if (!merchant) notFound();

  return (
    <div className="wt-container py-10">
      <div className="rounded-3xl border border-[var(--line)] bg-[rgba(31,61,50,0.08)] p-8">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--copper)]">
          Merchant · {merchant.plan.name}
        </p>
        <h1 className="mt-2 font-sans text-4xl font-semibold tracking-tight sm:text-5xl">
          {merchant.displayName}
        </h1>
        {merchant.region && (
          <p className="mt-2 text-[var(--ink-soft)]">{merchant.region}</p>
        )}
        {merchant.bio && (
          <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">{merchant.bio}</p>
        )}
      </div>

      <h2 className="mt-10 font-display text-2xl">Active listings</h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {merchant.listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      {merchant.listings.length === 0 && (
        <p className="mt-4 text-[var(--ink-soft)]">No active listings.</p>
      )}
    </div>
  );
}
