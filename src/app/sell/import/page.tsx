import Link from "next/link";
import { continueLegacyDraftsAction } from "@/lib/actions/ai";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import { limits } from "@/lib/catalog-import/files";
import { connectorAvailability } from "@/lib/catalog-import/connectors";
import { CatalogImportUpload } from "@/components/catalog-import-upload";
export const metadata = { title: "Bring My Catalog to WineBloom" };
export default async function ImportPage() {
  const t = await getTranslations("catalogImport");
  const { seller } = await requireSeller();
  const jobs = await prisma.catalogImportJob.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const legacyCount = await prisma.listingDraft.count({
    where: {
      sellerId: seller.id,
      importJobId: null,
      status: { notIn: ["APPROVED_AND_CREATED", "EXCLUDED"] },
    },
  });
  const limit = limits();
  return (
    <div className="wt-container py-10">
      <Link href="/sell" className="text-sm underline">
        Seller dashboard
      </Link>
      <p className="mt-6 text-xs uppercase tracking-widest text-[var(--copper)]">
        Seller tools
      </p>
      <h1 className="mt-2 text-4xl font-semibold">{t("title")}</h1>
      <p className="text-sm mt-2">{t("languageNotice")}</p>
      <p className="my-4 max-w-3xl text-[var(--ink-soft)]">
        Nothing publishes automatically. Review every imported product and
        approve private drafts before using the listing editor. You control
        descriptions, claims, images, prices, quantities and publication.
        Alcohol requires seller and destination eligibility.
      </p>
      <div className="my-6">
        <CatalogImportUpload maxBytes={limit.bytes} maxRows={limit.rows} />
      </div>
      {legacyCount > 0 && (
        <section className="my-6 rounded-xl border border-[var(--line)] p-5">
          <h2 className="text-xl font-semibold">
            Continue your earlier assistant drafts
          </h2>
          <p>
            {legacyCount} existing drafts can use the new review tools without
            creating copies.
          </p>
          <form action={continueLegacyDraftsAction} className="mt-3 grid gap-3">
            <label className="flex gap-2">
              <input name="authorized" type="checkbox" required />I own or am
              authorized to use these catalog descriptions and images.
            </label>
            <button className="wt-btn wt-btn-secondary justify-self-start">
              Continue reviewing existing drafts
            </button>
          </form>
        </section>
      )}
      <section className="grid gap-4 md:grid-cols-3">
        {(["shopify", "woocommerce"] as const).map((provider) => {
          const state = connectorAvailability(provider);
          return (
            <div
              className="rounded-2xl border border-[var(--line)] p-5"
              key={provider}
            >
              <h2 className="text-xl font-semibold">
                {provider === "shopify" ? "Shopify" : "WooCommerce"}
              </h2>
              <p className="my-3 text-sm">{state.reason}</p>
              <button className="wt-btn wt-btn-secondary" disabled>
                Connect {provider === "shopify" ? "Shopify" : "WooCommerce"}
              </button>
            </div>
          );
        })}
        <div className="rounded-2xl border border-[var(--line)] p-5">
          <h2 className="text-xl font-semibold">API / feed integration</h2>
          <p className="mt-3 text-sm">
            Larger sellers can export CSV or Excel today. Managed feeds,
            scheduled synchronization and verified live webhooks are coming
            soon. No order or customer data is shared.
          </p>
        </div>
      </section>
      <Link
        href="/sell/import/connections"
        className="wt-btn wt-btn-secondary mt-6"
      >
        Connections and synchronization history
      </Link>
      <section className="my-8">
        <h2 className="text-2xl font-semibold">Import mode</h2>
        <p className="mt-2">
          One-time import is available. Scheduled and live synchronization
          require an authorized store connection. Price and inventory
          synchronization can change your listings only when enabled.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Import history</h2>
        <div className="mt-4 grid gap-3">
          {jobs.map((job) => (
            <Link
              className="rounded-xl border border-[var(--line)] p-4 flex justify-between gap-4"
              key={job.id}
              href={`/sell/import/${job.id}`}
            >
              <span>
                {job.sourceName} · {job.sourceType}
              </span>
              <span>
                {job.status} · {job.processedRows}/{job.totalRows}
              </span>
            </Link>
          ))}
          {!jobs.length && <p>No imports yet.</p>}
        </div>
      </section>
    </div>
  );
}
