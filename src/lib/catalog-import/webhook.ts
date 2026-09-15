import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { catalogRateLimit } from "./service";
import {
  decryptCredentials,
  verifyWebhook,
  type CatalogAdapter,
  type Provider,
} from "./connectors";
import { productSchema } from "./product";
const eventSchema = z.object({
  externalProductId: z.string().min(1).max(200),
  externalVariantId: z.string().max(200).optional(),
  product: productSchema,
  deleted: z.boolean().optional(),
  occurredAt: z.iso.datetime(),
});
/** Called only by an installed production adapter. No arbitrary topics or full bodies are persisted. */
export async function acceptVerifiedWebhook(
  input: {
    connectionId: string;
    provider: Provider;
    storeIdentity: string;
    topic: string;
    signature: string | null;
    raw: Buffer;
  },
  adapter: CatalogAdapter,
) {
  if (adapter.provider !== input.provider) throw new Error("Adapter mismatch");
  if (input.raw.length > 1024 * 1024) throw new Error("Webhook too large");
  const connection = await prisma.catalogConnection.findFirst({
    where: {
      id: input.connectionId,
      provider: input.provider,
      storeId: input.storeIdentity,
      status: "ACTIVE",
      mode: "LIVE",
      verifiedAt: { not: null },
    },
  });
  if (!connection?.encryptedCredentials)
    throw new Error("Unknown or revoked store");
  const credentials = decryptCredentials(
    connection.encryptedCredentials,
    connection.id,
  );
  const secret =
    input.provider === "shopify"
      ? process.env.SHOPIFY_CLIENT_SECRET || ""
      : credentials.webhookSecret || "";
  if (!verifyWebhook(input.raw, input.signature, secret))
    throw new Error("Invalid webhook signature");
  if (
    ![
      "products/create",
      "products/update",
      "products/delete",
      "inventory_levels/update",
      "product.created",
      "product.updated",
      "product.deleted",
      "app/uninstalled",
    ].includes(input.topic)
  )
    throw new Error("Unsupported catalog topic");
  await catalogRateLimit(`webhook:${connection.id}`, 1000);
  if (input.topic === "app/uninstalled") {
    await prisma.catalogConnection.update({
      where: { id: connection.id },
      data: {
        status: "DISCONNECTED",
        revokedAt: new Date(),
        encryptedCredentials: null,
        nextSyncAt: null,
      },
    });
    return;
  }
  const events = z
    .array(eventSchema)
    .max(100)
    .parse(
      adapter.normalizeWebhook(JSON.parse(input.raw.toString()), input.topic),
    );
  // Hash the authenticated payload, never trust an unsigned event-ID header for deduplication.
  const digest = createHash("sha256").update(input.raw).digest("hex");
  for (const event of events)
    await prisma.catalogSyncEvent.upsert({
      where: {
        connectionId_eventKey: {
          connectionId: connection.id,
          eventKey: `${digest}:${event.externalProductId}:${event.externalVariantId || ""}`,
        },
      },
      create: {
        connectionId: connection.id,
        eventKey: `${digest}:${event.externalProductId}:${event.externalVariantId || ""}`,
        topic: input.topic,
        productJson: JSON.stringify({
          ...event.product,
          externalProductId: event.externalProductId,
          externalVariantId: event.externalVariantId || "",
          occurredAt: event.occurredAt,
          ...(event.deleted ? { status: "DELETED" } : {}),
        }),
      },
      update: {},
    });
}
