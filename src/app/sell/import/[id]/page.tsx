import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CatalogImportReview } from "@/components/catalog-import-review";
export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { seller } = await requireSeller();
  const { id } = await params;
  const job = await prisma.catalogImportJob.findFirst({
    where: { id, sellerId: seller.id },
  });
  if (!job) notFound();
  const templates = await prisma.catalogMapping.findMany({
    where: { sellerId: seller.id },
    select: { id: true, name: true, mappingJson: true },
    take: 100,
  });
  return <CatalogImportReview id={id} templates={templates} />;
}
