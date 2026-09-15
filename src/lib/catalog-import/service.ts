import { createHash, randomUUID } from "node:crypto";
import type { Prisma, ListingDraft } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { limits } from "./files";
import {
  canonicalUrl,
  fingerprint,
  mapRow,
  mappingSchema,
  productSchema,
  recognizeColumns,
  validateProduct,
  type Mapping,
  type Product,
} from "./product";
import { copyProductImage } from "./images";
export const AUTHORIZATION_TEXT =
  "I own or am authorized to use this catalog, website content and product images, and its terms permit this import. I remain responsible for accuracy and final publication.";
type Seller = { id: string; userId: string };
type DB = Prisma.TransactionClient;
export async function audit(
  db: DB,
  seller: Seller,
  action: string,
  meta: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: {
      actorId: seller.userId,
      action,
      meta: JSON.stringify({ sellerId: seller.id, ...meta }),
    },
  });
}
export async function catalogRateLimit(
  key: string,
  limit = 20,
  windowMs = 3600000,
) {
  const now = new Date();
  await prisma.catalogRateLimit.upsert({
    where: { key },
    create: { key, count: 0, expiresAt: new Date(now.getTime() + windowMs) },
    update: {},
  });
  await prisma.catalogRateLimit.updateMany({
    where: { key, expiresAt: { lte: now } },
    data: { count: 0, expiresAt: new Date(now.getTime() + windowMs) },
  });
  const result = await prisma.catalogRateLimit.updateMany({
    where: { key, count: { lt: limit } },
    data: { count: { increment: 1 } },
  });
  if (!result.count)
    throw new Error("Catalog request limit reached; try again later");
}
export async function createImport(
  seller: Seller,
  input: {
    rows: Product[];
    headers: string[];
    sourceType: string;
    sourceName: string;
    sourceUrl?: string;
    authorized: boolean;
    requestKey?: string;
    connectionId?: string;
  },
) {
  if (!input.authorized) throw new Error("Content authorization is required");
  if (!input.rows.length || input.rows.length > limits().rows)
    throw new Error("Invalid row count");
  if (
    input.connectionId &&
    !(await prisma.catalogConnection.findFirst({
      where: {
        id: input.connectionId,
        sellerId: seller.id,
        status: "ACTIVE",
        verifiedAt: { not: null },
      },
    }))
  )
    throw new Error("Source connection unavailable");
  const requestKey =
    input.requestKey ||
    createHash("sha256")
      .update(JSON.stringify([input.sourceType, input.rows]))
      .digest("hex");
  const existing = await prisma.catalogImportJob.findUnique({
    where: { sellerId_requestKey: { sellerId: seller.id, requestKey } },
  });
  if (existing) return existing;
  const mapping = recognizeColumns(input.headers);
  // The complete staged upload commits atomically. Worker transactions remain small.
  return prisma.$transaction(
    async (tx) => {
      const job = await tx.catalogImportJob.create({
        data: {
          sellerId: seller.id,
          sourceType: input.sourceType,
          sourceName: input.sourceName.slice(0, 200),
          sourceUrl: input.sourceUrl,
          requestKey,
          authorizedById: seller.userId,
          authorizationText: AUTHORIZATION_TEXT,
          mappingJson: JSON.stringify(mapping),
          headersJson: JSON.stringify(input.headers),
          totalRows: input.rows.length,
        },
      });
      for (let offset = 0; offset < input.rows.length; offset += 100) {
        await tx.listingDraft.createMany({
          data: input.rows.slice(offset, offset + 100).map((row, i) => ({
            sellerId: seller.id,
            createdById: seller.userId,
            importJobId: job.id,
            connectionId: input.connectionId,
            rowNumber: offset + i + 2,
            sourceName: input.sourceName.slice(0, 200),
            title: "",
            description: "",
            status: "STAGED",
            rawJson: JSON.stringify(row),
          })),
        });
      }
      await audit(tx, seller, "CATALOG_IMPORT_AUTHORIZED", {
        jobId: job.id,
        rows: input.rows.length,
        sourceType: input.sourceType,
      });
      return job;
    },
    { timeout: 120000 },
  );
}
export async function setMapping(
  seller: Seller,
  jobId: string,
  value: Mapping,
  templateName?: string,
) {
  const mapping = mappingSchema.parse(value);
  await prisma.$transaction(async (tx) => {
    const job = await tx.catalogImportJob.findFirst({
      where: { id: jobId, sellerId: seller.id, status: "MAPPING" },
    });
    if (!job) throw new Error("Import cannot be mapped");
    const headers = JSON.parse(job.headersJson) as string[];
    if (Object.keys(mapping).some((k) => !headers.includes(k)))
      throw new Error("Unknown source column");
    const changed = await tx.catalogImportJob.updateMany({
      where: { id: jobId, sellerId: seller.id, status: "MAPPING" },
      data: { mappingJson: JSON.stringify(mapping), status: "QUEUED" },
    });
    if (!changed.count) throw new Error("Import changed; refresh");
    if (templateName)
      await tx.catalogMapping.upsert({
        where: {
          sellerId_name: {
            sellerId: seller.id,
            name: templateName.slice(0, 80),
          },
        },
        create: {
          sellerId: seller.id,
          name: templateName.slice(0, 80),
          mappingJson: JSON.stringify(mapping),
        },
        update: { mappingJson: JSON.stringify(mapping) },
      });
    await audit(tx, seller, "CATALOG_IMPORT_QUEUED", { jobId });
  });
}
export async function findDuplicate(
  db: DB,
  sellerId: string,
  p: Product,
  excludeId: string,
  connectionId?: string | null,
) {
  const current = await db.listingDraft.findFirst({
    where: { id: excludeId, sellerId },
  });
  const keys: {
    listing: Prisma.ListingWhereInput;
    draft: Prisma.ListingDraftWhereInput;
  }[] = [];
  if (connectionId && p.externalProductId) {
    const key = {
      externalProductId: p.externalProductId,
      externalVariantId:
        p.externalVariantId && p.externalVariantId.length <= 200
          ? p.externalVariantId
          : null,
    };
    keys.push({
      listing: { sourceConnectionId: connectionId, ...key },
      draft: { connectionId, ...key },
    });
  }
  for (const field of ["sku", "gtin"] as const)
    if (p[field])
      keys.push({
        listing: { [field]: p[field] },
        draft: { [field]: p[field] },
      });
  if (p.sourceUrl) {
    try {
      const sourceUrl = canonicalUrl(p.sourceUrl);
      keys.push({ listing: { sourceUrl }, draft: { sourceUrl } });
    } catch {
      /* validation displays URL error */
    }
  }
  keys.push({
    listing: { importFingerprint: fingerprint(p) },
    draft: { fingerprint: fingerprint(p) },
  });
  for (const key of keys) {
    const listing = await db.listing.findFirst({
      where: { sellerId, ...key.listing },
      orderBy: { createdAt: "asc" },
    });
    if (listing) return { listingId: listing.id, draftId: null };
    const draft = await db.listingDraft.findFirst({
      where: {
        sellerId,
        id: { not: excludeId },
        status: { notIn: ["STAGED", "EXCLUDED"] },
        ...(current
          ? {
              OR: [
                { createdAt: { lt: current.createdAt } },
                { createdAt: current.createdAt, id: { lt: current.id } },
              ],
            }
          : {}),
        ...key.draft,
      },
      orderBy: { createdAt: "asc" },
    });
    if (draft) return { listingId: draft.approvedListingId, draftId: draft.id };
  }
  return { listingId: null, draftId: null };
}
function draftData(p: Product) {
  const v = validateProduct(p);
  return {
    title: p.title || "",
    description: p.description || "",
    category: p.category || null,
    priceCents:
      p.price && /^\d+(\.\d{1,2})?$/.test(p.price) && Number(p.price) <= 100000
        ? Math.round(Number(p.price) * 100)
        : null,
    quantity:
      p.quantity && /^\d+$/.test(p.quantity) && Number(p.quantity) <= 1000000
        ? Number(p.quantity)
        : null,
    currency: (p.currency || "").toLowerCase(),
    vintage: p.vintage && /^\d{4}$/.test(p.vintage) ? Number(p.vintage) : null,
    producer: p.producer || p.brand || null,
    bottleSizeMl:
      p.bottleSizeMl &&
      /^\d+$/.test(p.bottleSizeMl) &&
      Number(p.bottleSizeMl) < 1000000
        ? Number(p.bottleSizeMl)
        : null,
    productJson: JSON.stringify(p),
    sku: p.sku && p.sku.length <= 128 ? p.sku : null,
    gtin: p.gtin && p.gtin.length <= 14 ? p.gtin : null,
    sourceUrl: (() => {
      try {
        return p.sourceUrl ? canonicalUrl(p.sourceUrl) : null;
      } catch {
        return null;
      }
    })(),
    externalProductId:
      p.externalProductId && p.externalProductId.length <= 200
        ? p.externalProductId
        : null,
    externalVariantId:
      p.externalVariantId && p.externalVariantId.length <= 200
        ? p.externalVariantId
        : null,
    fingerprint: fingerprint(p),
    missingFieldsCsv: v.missing.join(","),
    validationErrorsJson: JSON.stringify(v.errors),
    confidence: v.confidence,
    status: v.ready ? "READY_FOR_APPROVAL" : "NEEDS_REVIEW",
    lastImportAt: new Date(),
  };
}
export async function processBatch(jobId: string, sellerId?: string) {
  const token = randomUUID();
  const now = new Date();
  const claim = await prisma.catalogImportJob.updateMany({
    where: {
      id: jobId,
      ...(sellerId ? { sellerId } : {}),
      status: { in: ["QUEUED", "RUNNING"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    data: {
      leaseToken: token,
      leaseUntil: new Date(Date.now() + 180000),
      status: "RUNNING",
    },
  });
  if (!claim.count) return;
  try {
    const job = await prisma.catalogImportJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    const rows = await prisma.listingDraft.findMany({
      where: { importJobId: job.id, sellerId: job.sellerId, status: "STAGED" },
      orderBy: { rowNumber: "asc" },
      take: limits().batch,
    });
    const batchStarted = Date.now();
    for (const row of rows) {
      if (Date.now() - batchStarted > 60000) break;
      const p = mapRow(JSON.parse(row.rawJson), JSON.parse(job.mappingJson));
      const media: string[] = [];
      const imageErrors: string[] = [];
      for (const url of (p.imageUrls || "")
        .split(/[|\n]/)
        .filter(Boolean)
        .slice(0, 8)) {
        if (Date.now() - batchStarted > 70000) {
          imageErrors.push(
            "Image copy time budget exceeded. Upload remaining images in the listing editor.",
          );
          break;
        }
        try {
          media.push(
            await copyProductImage(
              url,
              job.sellerId,
              Boolean(job.authorizedAt),
            ),
          );
        } catch {
          imageErrors.push(
            "Image could not be copied. Remove its source URL and upload an authorized image in the editor.",
          );
        }
      }
      await prisma.$transaction(async (tx) => {
        const lock = await tx.catalogImportJob.updateMany({
          where: { id: job.id, status: "RUNNING", leaseToken: token },
          data: { leaseUntil: new Date(Date.now() + 180000) },
        });
        if (!lock.count) return;
        const duplicate = await findDuplicate(
          tx,
          job.sellerId,
          p,
          row.id,
          row.connectionId,
        );
        const data = draftData(p);
        const errors = [
          ...JSON.parse(data.validationErrorsJson),
          ...imageErrors,
        ];
        const updated = await tx.listingDraft.updateMany({
          where: { id: row.id, sellerId: job.sellerId, status: "STAGED" },
          data: {
            ...data,
            sellerAssertionsJson: JSON.stringify({ images: media }),
            duplicateListingId: duplicate.listingId,
            duplicateDraftId: duplicate.draftId,
            validationErrorsJson: JSON.stringify(errors),
            status:
              errors.length || duplicate.listingId || duplicate.draftId
                ? "NEEDS_REVIEW"
                : data.status,
          },
        });
        if (updated.count)
          await tx.catalogImportJob.update({
            where: { id: job.id },
            data: { processedRows: { increment: 1 } },
          });
      });
    }
    const remaining = await prisma.listingDraft.count({
      where: { importJobId: job.id, status: "STAGED" },
    });
    await prisma.catalogImportJob.updateMany({
      where: { id: job.id, status: "RUNNING", leaseToken: token },
      data: {
        status: remaining ? "QUEUED" : "REVIEW",
        leaseToken: null,
        leaseUntil: null,
        error: null,
      },
    });
  } catch {
    await prisma.catalogImportJob.updateMany({
      where: { id: jobId, leaseToken: token, status: "RUNNING" },
      data: {
        status: "FAILED",
        leaseToken: null,
        leaseUntil: null,
        error: "Batch failed. Retry resumes unprocessed rows.",
      },
    });
  }
}
export async function changeJob(
  seller: Seller,
  jobId: string,
  action: "cancel" | "retry",
) {
  await prisma.$transaction(async (tx) => {
    const result = await tx.catalogImportJob.updateMany({
      where: {
        id: jobId,
        sellerId: seller.id,
        status: {
          in:
            action === "cancel"
              ? ["MAPPING", "QUEUED", "RUNNING", "FAILED"]
              : ["FAILED", "CANCELLED"],
        },
      },
      data: {
        status: action === "cancel" ? "CANCELLED" : "QUEUED",
        error: null,
        leaseToken: null,
        leaseUntil: null,
      },
    });
    if (!result.count) throw new Error("Import cannot be changed");
    await audit(tx, seller, `CATALOG_IMPORT_${action.toUpperCase()}`, {
      jobId,
    });
  });
}
export async function editRows(
  seller: Seller,
  edits: {
    id: string;
    version: number;
    product: Product;
    resolution?: string;
  }[],
) {
  if (!edits.length || edits.length > 100) throw new Error("Select 1–100 rows");
  await prisma.$transaction(async (tx) => {
    for (const edit of edits) {
      const p = productSchema.parse(edit.product);
      const row = await tx.listingDraft.findFirst({
        where: {
          id: edit.id,
          sellerId: seller.id,
          version: edit.version,
          status: { notIn: ["STAGED", "APPROVED_AND_CREATED"] },
        },
      });
      if (!row) throw new Error("Row changed or unavailable; refresh");
      if (
        edit.resolution &&
        !["SKIP", "SEPARATE", "UPDATE_DRAFT", "MERGE", "RESTORE"].includes(
          edit.resolution,
        )
      )
        throw new Error("Invalid duplicate resolution");
      const duplicate = await findDuplicate(
        tx,
        seller.id,
        p,
        row.id,
        row.connectionId,
      );
      const data = draftData(p);
      const resolution =
        edit.resolution === "RESTORE"
          ? null
          : edit.resolution || row.duplicateResolution;
      const imageErrors = (
        JSON.parse(row.validationErrorsJson) as string[]
      ).filter((e) => e.startsWith("Image"));
      const imagesChanged =
        p.imageUrls !== (JSON.parse(row.productJson) as Product).imageUrls;
      data.validationErrorsJson = JSON.stringify([
        ...JSON.parse(data.validationErrorsJson),
        ...(imagesChanged
          ? p.imageUrls
            ? [
                "Image URLs changed; remove them and upload images in the editor",
              ]
            : []
          : imageErrors),
      ]);
      const result = await tx.listingDraft.updateMany({
        where: { id: row.id, sellerId: seller.id, version: edit.version },
        data: {
          ...data,
          duplicateListingId: duplicate.listingId,
          duplicateDraftId: duplicate.draftId,
          duplicateResolution: resolution,
          version: { increment: 1 },
          ...(imagesChanged ? { sellerAssertionsJson: "{}" } : {}),
          status:
            resolution === "SKIP"
              ? "EXCLUDED"
              : JSON.parse(data.validationErrorsJson).length
                ? "NEEDS_REVIEW"
                : data.status,
        },
      });
      if (!result.count) throw new Error("Row changed; refresh");
    }
    await audit(tx, seller, "CATALOG_ROWS_EDITED", { count: edits.length });
  });
}
export async function approveRows(seller: Seller, ids: string[]) {
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
    throw new Error("Select 1–100 distinct rows");
  return prisma.$transaction(
    async (tx) => {
      // Serialize approvals per seller across jobs and workers, including new fingerprints.
      await tx.sellerProfile.update({
        where: { id: seller.id },
        data: { updatedAt: new Date() },
      });
      const output: string[] = [];
      for (const id of ids) {
        const row = await tx.listingDraft.findFirst({
          where: { id, sellerId: seller.id },
        });
        if (!row) throw new Error("Draft unavailable");
        if (row.status === "APPROVED_AND_CREATED" && row.approvedListingId) {
          output.push(row.approvedListingId);
          continue;
        }
        if (["EXCLUDED", "STAGED"].includes(row.status))
          throw new Error("Draft is not ready");
        const p = row.importJobId
          ? (JSON.parse(row.productJson) as Product)
          : legacyProduct(row);
        const v = validateProduct(p);
        if (!v.ready || JSON.parse(row.validationErrorsJson).length)
          throw new Error(
            "Complete missing fields and resolve validation errors first",
          );
        const match = await findDuplicate(
          tx,
          seller.id,
          p,
          row.id,
          row.connectionId,
        );
        let targetId: string | null = null;
        if (match.listingId || match.draftId) {
          if (
            row.duplicateResolution === "UPDATE_DRAFT" ||
            row.duplicateResolution === "MERGE"
          ) {
            targetId = match.listingId;
            if (!targetId && match.draftId) {
              const target = await tx.listingDraft.findFirst({
                where: {
                  id: match.draftId,
                  sellerId: seller.id,
                  status: {
                    notIn: ["STAGED", "APPROVED_AND_CREATED", "EXCLUDED"],
                  },
                },
              });
              if (!target) throw new Error("Duplicate draft unavailable");
              await tx.listingDraft.update({
                where: { id: target.id },
                data: {
                  ...draftData(p),
                  sellerAssertionsJson: row.sellerAssertionsJson,
                  version: { increment: 1 },
                },
              });
              await tx.listingDraft.update({
                where: { id: row.id },
                data: {
                  status: "EXCLUDED",
                  duplicateResolution: "MERGED",
                  version: { increment: 1 },
                },
              });
              continue;
            }
          } else if (row.duplicateResolution !== "SEPARATE")
            throw new Error("Resolve duplicate before approval");
        }
        const category = await tx.category.upsert({
          where: { slug: p.category },
          create: {
            slug: p.category,
            name:
              p.category === "wine-accessories"
                ? "Wine accessories"
                : p.category[0].toUpperCase() + p.category.slice(1),
          },
          update: {},
        });
        const alcohol = ["wine", "spirits"].includes(p.category);
        const data = {
          title: p.title,
          description: p.description,
          categoryId: category.id,
          priceCents: Math.round(Number(p.price) * 100),
          quantity: Number(p.quantity),
          currency: "eur",
          status: "DRAFT",
          imported: true,
          importComplianceStatus: "PENDING",
          catalogProductJson: JSON.stringify(p),
          containsAlcohol: alcohol,
          ageVerificationRequired: alcohol,
          signatureRequired: alcohol,
          sku: p.sku && p.sku.length <= 128 ? p.sku : null,
          gtin: p.gtin && p.gtin.length <= 14 ? p.gtin : null,
          sourceUrl: row.sourceUrl,
          importFingerprint: fingerprint(p),
          sourceConnectionId: row.connectionId,
          externalProductId:
            p.externalProductId && p.externalProductId.length <= 200
              ? p.externalProductId
              : null,
          externalVariantId:
            p.externalVariantId && p.externalVariantId.length <= 200
              ? p.externalVariantId
              : null,
          lastImportAt: new Date(),
          vintage: row.vintage,
          bottleSizeMl: row.bottleSizeMl,
          abv: p.abv ? Number(p.abv) : null,
          condition: p.condition || null,
          weightGrams: p.weightGrams ? Math.round(Number(p.weightGrams)) : null,
          lengthCm: p.lengthCm ? Number(p.lengthCm) : null,
          widthCm: p.widthCm ? Number(p.widthCm) : null,
          heightCm: p.heightCm ? Number(p.heightCm) : null,
          searchText: [p.title, p.description, p.producer, p.brand]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        };
        let listingId: string;
        if (targetId) {
          const updated = await tx.listing.updateMany({
            where: { id: targetId, sellerId: seller.id, status: "DRAFT" },
            data,
          });
          if (!updated.count)
            throw new Error(
              "Only private drafts can be overwritten; merge active listings manually in the editor",
            );
          listingId = targetId;
        } else {
          const listing = await tx.listing.create({
            data: {
              ...data,
              sellerId: seller.id,
              slug: `${slugify(p.title).slice(0, 100)}-${randomUUID()}`,
            },
          });
          listingId = listing.id;
        }
        const images: string[] =
          JSON.parse(row.sellerAssertionsJson || "{}").images || [];
        if (images.length) {
          await tx.listingImage.deleteMany({ where: { listingId } });
          for (const [i, url] of images.entries())
            await tx.listingImage.create({
              data: { listingId, url, sortOrder: i },
            });
        }
        const claim = await tx.listingDraft.updateMany({
          where: { id, sellerId: seller.id, version: row.version },
          data: {
            status: "APPROVED_AND_CREATED",
            approvedListingId: listingId,
            version: { increment: 1 },
          },
        });
        if (!claim.count) throw new Error("Concurrent draft approval; refresh");
        await audit(tx, seller, "CATALOG_DRAFT_APPROVED", {
          draftId: id,
          listingId,
        });
        output.push(listingId);
      }
      return output;
    },
    { timeout: 30000 },
  );
}
function legacyProduct(row: ListingDraft): Product {
  return {
    title: row.title,
    description: row.description,
    category: row.category || "",
    price: row.priceCents == null ? "" : String(row.priceCents / 100),
    quantity: row.quantity == null ? "" : String(row.quantity),
    currency: row.currency,
    producer: row.producer || "",
  };
}

/** Move pre-job assistant drafts into the same review queue without recreating products. */
export async function adoptLegacyDrafts(seller: Seller, authorized: boolean) {
  if (!authorized) throw new Error("Content authorization is required");
  return prisma.$transaction(
    async (tx) => {
      await tx.sellerProfile.update({
        where: { id: seller.id },
        data: { updatedAt: new Date() },
      });
      const rows = await tx.listingDraft.findMany({
        where: {
          sellerId: seller.id,
          importJobId: null,
          status: { notIn: ["APPROVED_AND_CREATED", "EXCLUDED"] },
        },
        orderBy: { createdAt: "asc" },
        take: limits().rows,
      });
      if (!rows.length) return null;
      const products = rows.map((row) => ({
        ...legacyProduct(row),
        vintage: row.vintage == null ? "" : String(row.vintage),
        bottleSizeMl: row.bottleSizeMl == null ? "" : String(row.bottleSizeMl),
        legacyAssertionsJson: row.sellerAssertionsJson || "",
      }));
      const headers = [...new Set(products.flatMap(Object.keys))];
      const job = await tx.catalogImportJob.create({
        data: {
          sellerId: seller.id,
          sourceType: "CSV",
          sourceName: "Previous assistant inventory",
          requestKey: createHash("sha256")
            .update(rows.map((r) => r.id).join(","))
            .digest("hex"),
          headersJson: JSON.stringify(headers),
          mappingJson: JSON.stringify(recognizeColumns(headers)),
          totalRows: rows.length,
          authorizedById: seller.userId,
          authorizationText: AUTHORIZATION_TEXT,
        },
      });
      for (const [i, row] of rows.entries())
        await tx.listingDraft.update({
          where: { id: row.id },
          data: {
            importJobId: job.id,
            rowNumber: i + 2,
            rawJson: JSON.stringify(products[i]),
            status: "STAGED",
          },
        });
      await audit(tx, seller, "CATALOG_LEGACY_DRAFTS_ADOPTED", {
        jobId: job.id,
        rows: rows.length,
      });
      return job.id;
    },
    { timeout: 30000 },
  );
}
