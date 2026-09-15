import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateUrl } from "./website";
import { audit, createImport, setMapping } from "./service";
import { limits } from "./files";
import { productSchema, recognizeColumns } from "./product";
import {
  decryptCredentials,
  encryptCredentials,
  syncFields,
  type CatalogAdapter,
} from "./connectors";
const modeSchema = z.enum(["ONE_TIME", "SCHEDULED", "LIVE"]);
const selectedFields = z
  .array(z.enum(["price", "quantity", "description", "images", "status"]))
  .max(5);
type Seller = { id: string; userId: string };
/** Internal authorized adapter entry point. No client-supplied store identity is trusted. */
export async function authorizeStore(
  seller: Seller,
  adapter: CatalogAdapter,
  input: {
    storeUrl: string;
    credentials: Record<string, string>;
    authorized: boolean;
    mode: string;
    syncFields?: string[];
  },
) {
  if (!input.authorized) throw new Error("Store authorization is required");
  const url = validateUrl(input.storeUrl);
  const mode = modeSchema.parse(input.mode);
  const allowed = selectedFields.parse(
    input.syncFields || ["price", "quantity"],
  );
  const identity = await adapter.verifyStore({
    storeUrl: url.toString(),
    credentials: input.credentials,
  });
  if (!identity.storeId || validateUrl(identity.storeUrl).origin !== url.origin)
    throw new Error("Store identity mismatch");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.catalogConnection.findUnique({
      where: {
        sellerId_provider_storeId: {
          sellerId: seller.id,
          provider: adapter.provider,
          storeId: identity.storeId,
        },
      },
    });
    const id = existing?.id || randomUUID();
    const encryptedCredentials = encryptCredentials(input.credentials, id);
    const data = {
      storeUrl: identity.storeUrl,
      encryptedCredentials,
      status: "ACTIVE",
      verifiedAt: new Date(),
      revokedAt: null,
      mode,
      syncFieldsJson: JSON.stringify(allowed),
      authorizedById: seller.userId,
      authorizedAt: new Date(),
      nextSyncAt: mode === "SCHEDULED" ? new Date() : null,
    };
    const connection = await tx.catalogConnection.upsert({
      where: { id },
      create: {
        id,
        sellerId: seller.id,
        provider: adapter.provider,
        storeId: identity.storeId,
        ...data,
      },
      update: data,
    });
    await audit(tx, seller, "CATALOG_STORE_AUTHORIZED", {
      connectionId: id,
      provider: adapter.provider,
      mode,
      fields: allowed,
    });
    return {
      id: connection.id,
      storeId: connection.storeId,
      status: connection.status,
    };
  });
}
export async function setSyncPolicy(
  seller: Seller,
  id: string,
  modeValue: string,
  fieldsValue: string[],
) {
  const mode = modeSchema.parse(modeValue);
  const fields = selectedFields.parse(fieldsValue);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogConnection.updateMany({
      where: {
        id,
        sellerId: seller.id,
        status: "ACTIVE",
        verifiedAt: { not: null },
      },
      data: {
        mode,
        syncFieldsJson: JSON.stringify([...new Set(fields)]),
        nextSyncAt: mode === "SCHEDULED" ? new Date() : null,
      },
    });
    if (!updated.count) throw new Error("Verified connection required");
    await audit(tx, seller, "CATALOG_SYNC_CONSENT_CHANGED", {
      connectionId: id,
      mode,
      fields,
    });
  });
}
/** Adapter pagination has a hard limit; new products always enter the shared draft queue. */
export async function importConnectedCatalog(
  seller: Seller,
  id: string,
  adapter: CatalogAdapter,
) {
  const connection = await prisma.catalogConnection.findFirst({
    where: {
      id,
      sellerId: seller.id,
      provider: adapter.provider,
      status: "ACTIVE",
      verifiedAt: { not: null },
    },
  });
  if (!connection?.encryptedCredentials)
    throw new Error("Verified connection required");
  const credentials = decryptCredentials(connection.encryptedCredentials, id);
  const products: Record<string, string>[] = [];
  let cursor: string | undefined;
  const cursors = new Set<string>();
  do {
    const page = await adapter.catalog({
      storeId: connection.storeId,
      credentials,
      cursor,
    });
    for (const event of page.products)
      products.push(
        productSchema.parse({
          ...event.product,
          externalProductId: event.externalProductId,
          externalVariantId: event.externalVariantId || "",
        }),
      );
    if (products.length > limits().rows)
      throw new Error("Connected catalog exceeds configured row limit");
    cursor = page.cursor;
    if (cursor && cursors.has(cursor))
      throw new Error("Repeated catalog cursor");
    if (cursor) cursors.add(cursor);
    if (cursors.size > 100) throw new Error("Catalog pagination limit reached");
  } while (cursor);
  const headers = [...new Set(products.flatMap(Object.keys))];
  const job = await createImport(seller, {
    rows: products,
    headers,
    sourceType: adapter.provider.toUpperCase(),
    sourceName: `${adapter.provider} catalog`,
    sourceUrl: connection.storeUrl,
    authorized: true,
    connectionId: id,
    requestKey: createHash("sha256")
      .update(JSON.stringify([id, products]))
      .digest("hex"),
  });
  if (job.status === "MAPPING")
    await setMapping(seller, job.id, recognizeColumns(headers));
  return job.id;
}
export async function pollConnectedCatalog(
  id: string,
  adapter: CatalogAdapter,
) {
  const connection = await prisma.catalogConnection.findFirst({
    where: {
      id,
      provider: adapter.provider,
      status: "ACTIVE",
      mode: "SCHEDULED",
      verifiedAt: { not: null },
    },
  });
  if (!connection?.encryptedCredentials)
    throw new Error("Verified scheduled connection required");
  const credentials = decryptCredentials(connection.encryptedCredentials, id);
  let cursor: string | undefined;
  let count = 0;
  const cursors = new Set<string>();
  do {
    const page = await adapter.catalog({
      storeId: connection.storeId,
      credentials,
      cursor,
    });
    for (const event of page.products) {
      if (++count > limits().rows)
        throw new Error("Sync catalog limit reached");
      const product = productSchema.parse(event.product);
      if (
        !event.externalProductId ||
        !Number.isFinite(Date.parse(event.occurredAt))
      )
        throw new Error("Source version and product identity required");
      const payload = {
        ...product,
        externalProductId: event.externalProductId,
        externalVariantId: event.externalVariantId || "",
        occurredAt: event.occurredAt,
        ...(event.deleted ? { status: "DELETED" } : {}),
      };
      const eventKey = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      await prisma.catalogSyncEvent.upsert({
        where: { connectionId_eventKey: { connectionId: id, eventKey } },
        create: {
          connectionId: id,
          eventKey,
          topic: "scheduled.product",
          productJson: JSON.stringify(payload),
        },
        update: {},
      });
    }
    cursor = page.cursor;
    if (cursor && cursors.has(cursor))
      throw new Error("Repeated source cursor");
    if (cursor) cursors.add(cursor);
    if (cursors.size > 100) throw new Error("Sync pagination limit reached");
  } while (cursor);
  await prisma.catalogConnection.update({
    where: { id },
    data: {
      lastSyncAt: new Date(),
      nextSyncAt: new Date(Date.now() + 15 * 60000),
    },
  });
  return {
    products: count,
    fields: JSON.parse(connection.syncFieldsJson) as typeof syncFields,
  };
}
