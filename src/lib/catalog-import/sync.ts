import { prisma } from "@/lib/db";
import { audit } from "./service";
import { syncPlan, type SyncField } from "./connectors";
import { validateProduct, type Product } from "./product";
import { z } from "zod";
import { copyProductImage } from "./images";
export async function disconnectStore(
  seller: { id: string; userId: string },
  id: string,
) {
  await prisma.$transaction(async (tx) => {
    const connection = await tx.catalogConnection.updateMany({
      where: { id, sellerId: seller.id },
      data: {
        status: "DISCONNECTED",
        encryptedCredentials: null,
        revokedAt: new Date(),
        nextSyncAt: null,
      },
    });
    if (!connection.count) throw new Error("Connection unavailable");
    await tx.listing.updateMany({
      where: {
        sellerId: seller.id,
        sourceConnectionId: id,
        syncStatus: { notIn: ["UNCERTAIN", "FAILED", "CONFLICT"] },
      },
      data: { syncStatus: "DISCONNECTED" },
    });
    await audit(tx, seller, "CATALOG_CONNECTION_REVOKED", {
      connectionId: id,
      keepListings: true,
    });
  });
}
async function applySyncEventTransaction(eventId: string) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.catalogSyncEvent.findUnique({
      where: { id: eventId },
      include: { connection: { include: { seller: true } } },
    });
    if (!event || event.status === "APPLIED") return;
    const connection = event.connection;
    if (connection.status !== "ACTIVE" || !connection.verifiedAt)
      throw new Error("Store is not verified and active");
    const claim = await tx.catalogSyncEvent.updateMany({
      where: { id: eventId, status: { in: ["QUEUED", "FAILED"] } },
      data: { status: "PROCESSING" },
    });
    if (!claim.count) return;
    if (connection.mode === "ONE_TIME") {
      await tx.catalogSyncEvent.update({
        where: { id: eventId },
        data: { status: "SKIPPED", error: "Synchronization consent disabled" },
      });
      return;
    }
    const source = JSON.parse(event.productJson) as Product;
    const listing = await tx.listing.findFirst({
      where: {
        sellerId: connection.sellerId,
        sourceConnectionId: connection.id,
        externalProductId: source.externalProductId,
        externalVariantId: source.externalVariantId || null,
      },
    });
    if (!source.externalProductId || !listing) {
      await tx.catalogSyncEvent.update({
        where: { id: eventId },
        data: {
          status: "FAILED",
          error: "Product match missing; import as a private draft first",
        },
      });
      return;
    }
    const baseline = JSON.parse(listing.syncBaselineJson) as Product;
    if (!source.occurredAt || !Number.isFinite(Date.parse(source.occurredAt)))
      throw new Error("Source event version required");
    if (
      baseline.__occurredAt &&
      Date.parse(source.occurredAt) <= Date.parse(baseline.__occurredAt)
    ) {
      await tx.catalogSyncEvent.update({
        where: { id: eventId },
        data: {
          status: "APPLIED",
          processedAt: new Date(),
          error: "Older or repeated source version ignored",
        },
      });
      return;
    }
    if (source.status === "DELETED") {
      await tx.listing.updateMany({
        where: {
          id: listing.id,
          sellerId: connection.sellerId,
          updatedAt: listing.updatedAt,
        },
        data: {
          syncStatus: "UNCERTAIN",
          ...(listing.status === "ACTIVE" ? { status: "UNLISTED" } : {}),
        },
      });
      await tx.catalogSyncEvent.update({
        where: { id: eventId },
        data: {
          status: "FAILED",
          error:
            "Product deleted at source. Review inventory or disconnect and explicitly reconcile stock before selling.",
        },
      });
      await audit(
        tx,
        { id: connection.sellerId, userId: connection.seller.userId },
        "CATALOG_SOURCE_PRODUCT_DELETED",
        { eventId, listingId: listing.id },
      );
      return;
    }
    const local = {
      price: String(listing.priceCents / 100),
      quantity: String(listing.quantity),
      description: listing.description,
      status: listing.status,
    };
    const plan = syncPlan(
      JSON.parse(listing.syncBaselineJson),
      local,
      source,
      JSON.parse(connection.syncFieldsJson) as SyncField[],
    );
    const inventoryUncertain =
      plan.conflicts.includes("quantity") ||
      (plan.updates.quantity !== undefined &&
        (!/^\d+$/.test(plan.updates.quantity) ||
          Number(plan.updates.quantity) > 1000000)) ||
      listing.status === "RESERVED";
    const invalidDescription =
      plan.updates.description !== undefined &&
      validateProduct({
        ...JSON.parse(listing.catalogProductJson),
        description: plan.updates.description,
      }).errors.length > 0;
    const invalidPrice =
      plan.updates.price !== undefined &&
      (!/^\d+(\.\d{1,2})?$/.test(plan.updates.price) ||
        Number(plan.updates.price) < 1 ||
        Number(plan.updates.price) > 100000);
    if (
      inventoryUncertain ||
      invalidPrice ||
      invalidDescription ||
      plan.conflicts.length ||
      plan.updates.images
    ) {
      // Do not disturb reservations. Checkout also checks syncStatus, including after release.
      await tx.listing.updateMany({
        where: {
          id: listing.id,
          sellerId: connection.sellerId,
          updatedAt: listing.updatedAt,
        },
        data: {
          syncStatus: "CONFLICT",
          ...(listing.status === "ACTIVE" ? { status: "UNLISTED" } : {}),
        },
      });
      await tx.catalogSyncEvent.update({
        where: { id: eventId },
        data: {
          status: "CONFLICT",
          conflictsJson: JSON.stringify({
            fields: plan.conflicts,
            baseline,
            local,
            source,
          }),
          error:
            "Review source inventory, seller edits and image changes before resuming",
        },
      });
      return;
    }
    const result = await tx.listing.updateMany({
      where: {
        id: listing.id,
        sellerId: connection.sellerId,
        updatedAt: listing.updatedAt,
        status: { not: "RESERVED" },
      },
      data: {
        ...(plan.updates.price !== undefined
          ? { priceCents: Math.round(Number(plan.updates.price) * 100) }
          : {}),
        ...(plan.updates.quantity !== undefined
          ? { quantity: Number(plan.updates.quantity) }
          : {}),
        ...(plan.updates.description !== undefined && listing.imported
          ? {
              importComplianceStatus: "PENDING",
              importComplianceReviewJson: null,
              status: listing.status === "ACTIVE" ? "UNLISTED" : listing.status,
            }
          : {}),
        ...(plan.updates.description !== undefined
          ? { description: plan.updates.description.slice(0, 10000) }
          : {}),
        ...(plan.updates.status ? { status: "UNLISTED" } : {}),
        lastSyncAt: new Date(),
        syncStatus: "SYNCED",
        syncBaselineJson: JSON.stringify({
          ...JSON.parse(listing.syncBaselineJson),
          ...plan.updates,
          __occurredAt: source.occurredAt,
        }),
      },
    });
    if (!result.count) throw new Error("Concurrent inventory change; retry");
    await tx.catalogSyncEvent.update({
      where: { id: eventId },
      data: { status: "APPLIED", processedAt: new Date() },
    });
    await audit(
      tx,
      { id: connection.sellerId, userId: connection.seller.userId },
      "CATALOG_SYNCHRONIZED",
      { eventId, listingId: listing.id },
    );
  });
}

/** Explicit seller conflict resolution, fenced against inventory reservations and later edits. */
export async function resolveSyncConflict(
  seller: { id: string; userId: string },
  eventId: string,
  input: {
    listingUpdatedAt: string;
    choices: Record<string, "LOCAL" | "SOURCE">;
  },
) {
  const choices = z
    .record(z.string(), z.enum(["LOCAL", "SOURCE"]))
    .refine((v) =>
      Object.keys(v).every((k) =>
        ["price", "quantity", "description", "images", "status"].includes(k),
      ),
    )
    .parse(input.choices);
  const event = await prisma.catalogSyncEvent.findFirst({
    where: {
      id: eventId,
      status: "CONFLICT",
      connection: { sellerId: seller.id, status: "ACTIVE" },
    },
    include: { connection: true },
  });
  if (!event) throw new Error("Conflict unavailable");
  const source = JSON.parse(event.productJson) as Product;
  const copiedImages: string[] = [];
  if (choices.images === "SOURCE")
    for (const url of (source.images || source.imageUrls || "")
      .split(/[|\n]/)
      .filter(Boolean)
      .slice(0, 8))
      copiedImages.push(
        await copyProductImage(
          url,
          seller.id,
          Boolean(event.connection.authorizedAt),
        ),
      );
  return prisma.$transaction(async (tx) => {
    const currentEvent = await tx.catalogSyncEvent.findFirst({
      where: {
        id: event.id,
        status: "CONFLICT",
        connection: { sellerId: seller.id, status: "ACTIVE" },
      },
    });
    if (!currentEvent) throw new Error("Conflict changed; refresh");
    const listing = await tx.listing.findFirst({
      where: {
        sellerId: seller.id,
        sourceConnectionId: event.connectionId,
        externalProductId: source.externalProductId,
        externalVariantId: source.externalVariantId || null,
      },
    });
    if (
      !listing ||
      listing.status === "RESERVED" ||
      listing.updatedAt.toISOString() !== input.listingUpdatedAt
    )
      throw new Error("Inventory reserved or listing changed; refresh");
    const consent = JSON.parse(event.connection.syncFieldsJson) as SyncField[];
    const sourceFields = Object.keys(source).filter((f) =>
      consent.includes(f as SyncField),
    );
    if (sourceFields.some((f) => !choices[f]))
      throw new Error(
        "Choose a resolution for every synchronized source field",
      );
    const selected: Product = {};
    for (const [f, choice] of Object.entries(choices))
      if (choice === "SOURCE") {
        if (!consent.includes(f as SyncField))
          throw new Error("Synchronization field not authorized");
        if (source[f] !== undefined) selected[f] = source[f];
      }
    if (
      selected.price !== undefined &&
      (!/^\d+(\.\d{1,2})?$/.test(selected.price) ||
        Number(selected.price) < 1 ||
        Number(selected.price) > 100000)
    )
      throw new Error("Invalid source price");
    if (
      selected.quantity !== undefined &&
      (!/^\d+$/.test(selected.quantity) || Number(selected.quantity) > 1000000)
    )
      throw new Error("Invalid source inventory");
    if (
      selected.description !== undefined &&
      validateProduct({
        ...JSON.parse(listing.catalogProductJson),
        description: selected.description,
      }).errors.length
    )
      throw new Error("Source description needs product review");
    const local = {
      price: String(listing.priceCents / 100),
      quantity: String(listing.quantity),
      description: listing.description,
      status: listing.status,
    };
    const result = await tx.listing.updateMany({
      where: {
        id: listing.id,
        sellerId: seller.id,
        updatedAt: listing.updatedAt,
        status: { not: "RESERVED" },
      },
      data: {
        ...((selected.description !== undefined ||
          choices.images === "SOURCE") &&
        listing.imported
          ? {
              importComplianceStatus: "PENDING",
              importComplianceReviewJson: null,
              status: listing.status === "ACTIVE" ? "UNLISTED" : listing.status,
            }
          : {}),
        ...(selected.price !== undefined
          ? { priceCents: Math.round(Number(selected.price) * 100) }
          : {}),
        ...(selected.quantity !== undefined
          ? { quantity: Number(selected.quantity) }
          : {}),
        ...(selected.description !== undefined
          ? { description: selected.description }
          : {}),
        ...(selected.status && ["DELETED", "UNLISTED"].includes(selected.status)
          ? { status: "UNLISTED" }
          : {}),
        syncStatus: "SYNCED",
        lastSyncAt: new Date(),
        syncBaselineJson: JSON.stringify({
          ...local,
          ...selected,
          __occurredAt: source.occurredAt,
        }),
      },
    });
    if (!result.count) throw new Error("Concurrent inventory change; refresh");
    if (choices.images === "SOURCE") {
      await tx.listingImage.deleteMany({ where: { listingId: listing.id } });
      for (const [sortOrder, url] of copiedImages.entries())
        await tx.listingImage.create({
          data: { listingId: listing.id, url, sortOrder },
        });
    }
    // Choosing local explicitly withdraws source control of those fields.
    await tx.catalogConnection.update({
      where: { id: event.connectionId },
      data: {
        syncFieldsJson: JSON.stringify(
          consent.filter((f) => choices[f] !== "LOCAL"),
        ),
      },
    });
    await tx.catalogSyncEvent.update({
      where: { id: event.id },
      data: { status: "APPLIED", processedAt: new Date(), error: null },
    });
    await audit(tx, seller, "CATALOG_CONFLICT_RESOLVED", {
      eventId,
      listingId: listing.id,
      choices,
    });
  });
}

export async function applySyncEvent(eventId: string) {
  try {
    return await applySyncEventTransaction(eventId);
  } catch {
    await prisma.$transaction(async (tx) => {
      const event = await tx.catalogSyncEvent.findFirst({
        where: {
          id: eventId,
          status: { in: ["QUEUED", "FAILED", "PROCESSING"] },
        },
        include: { connection: { include: { seller: true } } },
      });
      if (!event || event.connection.status !== "ACTIVE") return;
      let product: Product = {};
      try {
        product = JSON.parse(event.productJson);
      } catch {
        /* Fail closed for the affected connection. */
      }
      const where = {
        sellerId: event.connection.sellerId,
        sourceConnectionId: event.connectionId,
        ...(product.externalProductId
          ? {
              externalProductId: product.externalProductId,
              externalVariantId: product.externalVariantId || null,
            }
          : {}),
      };
      await tx.listing.updateMany({ where, data: { syncStatus: "UNCERTAIN" } });
      await tx.listing.updateMany({
        where: { ...where, status: "ACTIVE" },
        data: { status: "UNLISTED" },
      });
      await tx.catalogSyncEvent.update({
        where: { id: eventId },
        data: {
          status: "FAILED",
          error:
            "Source synchronization failed. Inventory is paused pending review or retry.",
        },
      });
      await audit(
        tx,
        {
          id: event.connection.sellerId,
          userId: event.connection.seller.userId,
        },
        "CATALOG_SYNC_FAILED",
        { eventId, connectionId: event.connectionId },
      );
    });
  }
}
