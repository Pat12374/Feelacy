import { notFound } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { seller } = await requireSeller();
  const { id } = await params;
  const listing = await prisma.listing.findFirst({
    where: { id, sellerId: seller.id },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  if (!listing) notFound();

  const [categories, regions, producers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
    prisma.producer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-3xl font-semibold tracking-tight">Edit listing</h1>
      <div className="mt-8">
        <ListingForm
          listing={listing}
          categories={categories}
          regions={regions}
          producers={producers}
        />
      </div>
    </div>
  );
}
