import { getTranslations } from "next-intl/server";
import { ListingForm } from "@/components/listing-form";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function generateMetadata() {
  const t = await getTranslations("sell");
  return { title: t("newListing") };
}

export default async function NewListingPage() {
  const t = await getTranslations("sell");
  await requireSeller();
  const [categories, regions, producers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
    prisma.producer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-3xl font-semibold tracking-tight">{t("newFixedListing")}</h1>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("noAuctions")}</p>
      <div className="mt-8">
        <ListingForm
          categories={categories}
          regions={regions}
          producers={producers}
        />
      </div>
    </div>
  );
}
