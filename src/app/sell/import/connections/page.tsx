import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { CatalogConnectionControls } from "@/components/catalog-connection-controls";
export default async function CatalogConnectionsPage() {
  const { seller } = await requireSeller();
  const connections = await prisma.catalogConnection.findMany({
    where: { sellerId: seller.id },
    select: {
      id: true,
      provider: true,
      storeUrl: true,
      status: true,
      mode: true,
      syncFieldsJson: true,
      lastSyncAt: true,
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, status: true, error: true, productJson: true },
      },
    },
    take: 50,
  });
  const data = await Promise.all(
    connections.map(async (c) => ({
      ...c,
      events: await Promise.all(
        c.events.map(async (e) => {
          const source = JSON.parse(e.productJson) as Record<string, string>;
          const listing = source.externalProductId
            ? await prisma.listing.findFirst({
                where: {
                  sellerId: seller.id,
                  sourceConnectionId: c.id,
                  externalProductId: source.externalProductId,
                  externalVariantId: source.externalVariantId || null,
                },
                select: { updatedAt: true },
              })
            : null;
          return {
            id: e.id,
            status: e.status,
            error: e.error,
            source,
            listingUpdatedAt: listing?.updatedAt.toISOString() || null,
          };
        }),
      ),
    })),
  );
  return (
    <div className="wt-container py-10">
      <Link href="/sell/import" className="underline">
        All imports
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Connected catalogs</h1>
      <p className="my-4">
        Manage source permissions, review synchronization history and resolve
        conflicts. New Shopify and WooCommerce connections remain unavailable
        until production adapters are configured and authorized.
      </p>
      {data.map((c) => (
        <section
          className="my-6 rounded-2xl border border-[var(--line)] p-6"
          key={c.id}
        >
          <h2 className="text-2xl font-semibold">
            {c.provider} · {c.status}
          </h2>
          <p className="mb-4">
            {c.storeUrl} · Last synchronization:{" "}
            {c.lastSyncAt?.toISOString() || "Never"}
          </p>
          <CatalogConnectionControls
            id={c.id}
            status={c.status}
            mode={c.mode}
            fields={JSON.parse(c.syncFieldsJson)}
            events={c.events}
          />
        </section>
      ))}
      {!data.length && (
        <p>
          No connected catalogs. Use a CSV, Excel or authorized website import
          to get started.
        </p>
      )}
    </div>
  );
}
