import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { accessory } from "./fixtures";
import type { Product } from "./product";
const context = vi.hoisted(() => ({
  db: undefined as unknown as PrismaClient,
}));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return context.db;
  },
}));
import {
  approveRows,
  changeJob,
  createImport,
  editRows,
  processBatch,
  setMapping,
} from "./service";
import { applySyncEvent } from "./sync";
let directory: string;
const seller = { id: "seller-a", userId: "user-a" };
const other = { id: "seller-b", userId: "user-b" };
beforeAll(async () => {
  directory = mkdtempSync(
    join(process.cwd(), "node_modules/.feelacy-import-test-"),
  );
  const schema = readFileSync("prisma/schema.prisma", "utf8")
    .replace('provider = "postgresql"', 'provider = "sqlite"')
    .replace("payload     Json?", "payload     String?")
    .replace(
      'provider = "prisma-client-js"',
      `provider = "prisma-client-js"\n  output = ${JSON.stringify(join(directory, "client"))}`,
    );
  const path = join(directory, "schema.prisma");
  writeFileSync(path, schema);
  writeFileSync(join(directory, "test.db"), "");
  const url = `file:${join(directory, "test.db")}`;
  execFileSync(
    "node_modules/.bin/prisma",
    ["db", "push", "--schema", path, "--skip-generate"],
    {
      env: {
        ...process.env,
        PRISMA_GENERATE_SKIP_AUTOINSTALL: "true",
        DATABASE_URL: url,
      },
      stdio: "pipe",
    },
  );
  execFileSync("node_modules/.bin/prisma", ["generate", "--schema", path], {
    env: {
      ...process.env,
      PRISMA_GENERATE_SKIP_AUTOINSTALL: "true",
      DATABASE_URL: url,
    },
    stdio: "pipe",
  });
  const IsolatedPrismaClient = createRequire(import.meta.url)(
    join(directory, "client"),
  ).PrismaClient;
  context.db = new IsolatedPrismaClient({ datasources: { db: { url } } });
  await context.db.sellerPlan.create({
    data: {
      id: "plan",
      code: "TEST",
      name: "Test",
      monthlyPriceCents: 0,
      defaultCommissionBps: 1000,
    },
  });
  for (const s of [seller, other]) {
    await context.db.user.create({
      data: { id: s.userId, email: `${s.id}@example.com` },
    });
    await context.db.sellerProfile.create({
      data: {
        id: s.id,
        userId: s.userId,
        slug: s.id,
        displayName: s.id,
        planId: "plan",
        commissionBps: 1000,
      },
    });
  }
}, 30000);
afterAll(async () => {
  await context.db?.$disconnect();
  if (directory) rmSync(directory, { recursive: true, force: true });
});
async function job(rows: Product[] = [accessory], key = crypto.randomUUID()) {
  return createImport(seller, {
    rows,
    headers: Object.keys(rows[0]),
    sourceType: "CSV",
    sourceName: "catalog.csv",
    authorized: true,
    requestKey: key,
  });
}
async function prepare(rows: Product[] = [accessory]) {
  const j = await job(rows);
  await setMapping(
    seller,
    j.id,
    Object.fromEntries(Object.keys(rows[0]).map((k) => [k, k])),
  );
  await processBatch(j.id);
  return {
    job: j,
    rows: await context.db.listingDraft.findMany({
      where: { importJobId: j.id },
      orderBy: { rowNumber: "asc" },
    }),
  };
}
describe("persisted catalog workflow", () => {
  it("records authorization and deduplicates upload retry", async () => {
    const key = crypto.randomUUID();
    const first = await job([accessory], key);
    const retry = await job([accessory], key);
    expect(first.id).toBe(retry.id);
    expect(first.authorizedById).toBe(seller.userId);
    expect(first.authorizationText).toMatch(/authorized/);
  });
  it("refuses absent source authorization", async () => {
    await expect(
      createImport(seller, {
        rows: [accessory],
        headers: [],
        sourceType: "WEBSITE",
        sourceName: "web",
        authorized: false,
      }),
    ).rejects.toThrow(/authorization/);
  });
  it("scopes mapping and job changes to seller", async () => {
    const j = await job();
    await expect(setMapping(other, j.id, {})).rejects.toThrow();
    await expect(changeJob(other, j.id, "cancel")).rejects.toThrow();
  });
  it("imports mixed validity rows and approves only valid private drafts idempotently", async () => {
    const good = { ...accessory, title: "Unique display A", sku: "A" };
    const result = await prepare([
      good,
      { ...good, title: "Invalid", quantity: "" },
    ]);
    expect(result.rows[0].status).toBe("READY_FOR_APPROVAL");
    expect(result.rows[1].missingFieldsCsv).toContain("quantity");
    const ids = await approveRows(seller, [result.rows[0].id]);
    const retry = await approveRows(seller, [result.rows[0].id]);
    expect(retry).toEqual(ids);
    const listing = await context.db.listing.findUniqueOrThrow({
      where: { id: ids[0] },
    });
    expect(listing.status).toBe("DRAFT");
    expect(listing.containsAlcohol).toBe(false);
    expect(listing.importComplianceStatus).toBe("PENDING");
    await expect(approveRows(other, [result.rows[0].id])).rejects.toThrow();
  });
  it("matches existing SKU and requires explicit duplicate resolution", async () => {
    const result = await prepare([
      { ...accessory, title: "Different title", sku: "A" },
    ]);
    expect(result.rows[0].duplicateListingId).toBeTruthy();
    await expect(approveRows(seller, [result.rows[0].id])).rejects.toThrow(
      /duplicate/,
    );
    await editRows(seller, [
      {
        id: result.rows[0].id,
        version: 0,
        product: JSON.parse(result.rows[0].productJson),
        resolution: "UPDATE_DRAFT",
      },
    ]);
    const ids = await approveRows(seller, [result.rows[0].id]);
    expect(ids[0]).toBe(result.rows[0].duplicateListingId);
  });
  it("cancels and retries only unprocessed rows", async () => {
    const j = await job([{ ...accessory, title: "Resumed row" }]);
    await setMapping(
      seller,
      j.id,
      Object.fromEntries(Object.keys(accessory).map((k) => [k, k])),
    );
    await changeJob(seller, j.id, "cancel");
    await processBatch(j.id);
    expect(
      (
        await context.db.catalogImportJob.findUniqueOrThrow({
          where: { id: j.id },
        })
      ).processedRows,
    ).toBe(0);
    await changeJob(seller, j.id, "retry");
    await processBatch(j.id);
    await processBatch(j.id);
    expect(
      await context.db.listingDraft.count({ where: { importJobId: j.id } }),
    ).toBe(1);
    expect(
      (
        await context.db.catalogImportJob.findUniqueOrThrow({
          where: { id: j.id },
        })
      ).processedRows,
    ).toBe(1);
  });
  it("preserves newer edits with optimistic concurrency", async () => {
    const r = (await prepare([{ ...accessory, title: "Editable row" }]))
      .rows[0];
    await editRows(seller, [
      { id: r.id, version: 0, product: { ...accessory, title: "Edited row" } },
    ]);
    await expect(
      editRows(seller, [{ id: r.id, version: 0, product: accessory }]),
    ).rejects.toThrow(/changed/);
  });
  it("bulk approval is atomic and never publishes alcohol", async () => {
    const wine = {
      title: "Wine bottle",
      description: "Seller supplied wine description for review.",
      category: "wine",
      price: "30",
      currency: "EUR",
      quantity: "2",
      producer: "Producer",
      wineType: "Red",
      country: "DE",
      region: "Region",
      vintage: "2020",
      bottleSizeMl: "750",
      abv: "13",
      grapeVariety: "Pinot",
      condition: "Good",
      provenance: "Seller records",
      caseQuantity: "1",
    };
    const result = await prepare([
      wine,
      { ...wine, title: "Second wine", sku: "W2" },
    ]);
    const ids = await approveRows(
      seller,
      result.rows.map((r) => r.id),
    );
    const listings = await context.db.listing.findMany({
      where: { id: { in: ids } },
    });
    expect(
      listings.every(
        (l) =>
          l.status === "DRAFT" &&
          l.containsAlcohol &&
          l.signatureRequired &&
          l.ageVerificationRequired,
      ),
    ).toBe(true);
  });
  it("pauses uncertain inventory and preserves reservations", async () => {
    const connection = await context.db.catalogConnection.create({
      data: {
        sellerId: seller.id,
        provider: "shopify",
        storeId: "fixture-store",
        mode: "LIVE",
        storeUrl: "https://fixture.example.com",
        authorizedById: seller.userId,
        status: "ACTIVE",
        verifiedAt: new Date(),
      },
    });
    const listing = await context.db.listing.create({
      data: {
        sellerId: seller.id,
        title: "Sync product",
        description: "Fixture",
        slug: "sync-fixture",
        priceCents: 1000,
        quantity: 2,
        status: "RESERVED",
        sourceConnectionId: connection.id,
        externalProductId: "p1",
        syncBaselineJson: JSON.stringify({ quantity: "3", price: "10" }),
      },
    });
    const event = await context.db.catalogSyncEvent.create({
      data: {
        connectionId: connection.id,
        eventKey: "e1",
        topic: "inventory",
        productJson: JSON.stringify({
          externalProductId: "p1",
          quantity: "5",
          occurredAt: "2026-09-07T12:00:00.000Z",
        }),
      },
    });
    await applySyncEvent(event.id);
    const updated = await context.db.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(updated.quantity).toBe(2);
    expect(updated.status).toBe("RESERVED");
    expect(updated.syncStatus).toBe("CONFLICT");
  });
});

describe("catalog worker and webhook recovery", () => {
  it("processes multiple batches with stable row counts", async () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({
      ...accessory,
      title: `Batch product ${i}`,
      sku: `BATCH-${i}`,
    }));
    const j = await job(rows);
    await setMapping(
      seller,
      j.id,
      Object.fromEntries(Object.keys(rows[0]).map((k) => [k, k])),
    );
    await processBatch(j.id);
    expect(
      (
        await context.db.catalogImportJob.findUniqueOrThrow({
          where: { id: j.id },
        })
      ).processedRows,
    ).toBe(25);
    await processBatch(j.id);
    await processBatch(j.id);
    const done = await context.db.catalogImportJob.findUniqueOrThrow({
      where: { id: j.id },
    });
    expect(done.status).toBe("REVIEW");
    expect(done.processedRows).toBe(31);
    expect(
      await context.db.listingDraft.count({ where: { importJobId: j.id } }),
    ).toBe(31);
  });
  it("does not overwrite an active matched listing", async () => {
    await context.db.listing.create({
      data: {
        sellerId: seller.id,
        title: "Live product",
        slug: "live-match",
        description: "Live description",
        priceCents: 5000,
        quantity: 3,
        status: "ACTIVE",
        sku: "LIVE-MATCH",
      },
    });
    const r = (
      await prepare([
        { ...accessory, title: "Incoming live match", sku: "LIVE-MATCH" },
      ])
    ).rows[0];
    await editRows(seller, [
      {
        id: r.id,
        version: 0,
        product: JSON.parse(r.productJson),
        resolution: "UPDATE_DRAFT",
      },
    ]);
    await expect(approveRows(seller, [r.id])).rejects.toThrow(
      /Only private drafts/,
    );
    expect(
      (
        await context.db.listing.findUniqueOrThrow({
          where: { slug: "live-match" },
        })
      ).priceCents,
    ).toBe(5000);
  });
  it.each(["shopify", "woocommerce"] as const)(
    "persists idempotent verified %s webhook events and rejects another store",
    async (provider) => {
      const { encryptCredentials } = await import("./connectors");
      const { acceptVerifiedWebhook } = await import("./webhook");
      const { fixtureAdapter } = await import("./fixture-adapter");
      const { createHmac } = await import("node:crypto");
      vi.stubEnv(
        "CATALOG_CREDENTIAL_KEY",
        Buffer.alloc(32, 2).toString("base64"),
      );
      vi.stubEnv("SHOPIFY_CLIENT_SECRET", "webhook-test-secret");
      const id = `verified-${provider}`;
      await context.db.catalogConnection.create({
        data: {
          id,
          sellerId: seller.id,
          provider,
          storeId: `verified-store-${provider}`,
          storeUrl: "https://fixture.example.com",
          mode: "LIVE",
          status: "ACTIVE",
          verifiedAt: new Date(),
          authorizedById: seller.userId,
          encryptedCredentials: encryptCredentials(
            { webhookSecret: "webhook-test-secret" },
            id,
          ),
        },
      });
      const raw = Buffer.from('{"fixture":"product"}');
      const signature = createHmac("sha256", "webhook-test-secret")
        .update(raw)
        .digest("base64");
      const input = {
        connectionId: id,
        provider,
        storeIdentity: `verified-store-${provider}`,
        topic: "products/update",
        signature,
        raw,
      };
      await acceptVerifiedWebhook(input, fixtureAdapter(provider));
      await acceptVerifiedWebhook(input, fixtureAdapter(provider));
      expect(
        await context.db.catalogSyncEvent.count({
          where: { connectionId: id },
        }),
      ).toBe(1);
      await expect(
        acceptVerifiedWebhook(
          { ...input, storeIdentity: "another-store" },
          fixtureAdapter(provider),
        ),
      ).rejects.toThrow();
      await expect(
        acceptVerifiedWebhook(
          { ...input, raw: Buffer.from("tampered") },
          fixtureAdapter(provider),
        ),
      ).rejects.toThrow(/signature/);
      vi.unstubAllEnvs();
    },
  );
});

describe("connected catalog lifecycle", () => {
  it("verifies store identity, imports through ListingDraft and binds external identifiers", async () => {
    const {
      authorizeStore,
      importConnectedCatalog,
      setSyncPolicy,
      pollConnectedCatalog,
    } = await import("./connections");
    const { fixtureAdapter } = await import("./fixture-adapter");
    vi.stubEnv(
      "CATALOG_CREDENTIAL_KEY",
      Buffer.alloc(32, 3).toString("base64"),
    );
    const adapter = fixtureAdapter("woocommerce");
    await expect(
      authorizeStore(other, adapter, {
        storeUrl: "https://fixture.example.com",
        credentials: { token: "wrong" },
        authorized: true,
        mode: "ONE_TIME",
      }),
    ).rejects.toThrow(/authorization/);
    const conn = await authorizeStore(other, adapter, {
      storeUrl: "https://fixture.example.com",
      credentials: { token: "fixture-only" },
      authorized: true,
      mode: "ONE_TIME",
    });
    const jobId = await importConnectedCatalog(other, conn.id, adapter);
    await processBatch(jobId);
    const row = await context.db.listingDraft.findFirstOrThrow({
      where: { importJobId: jobId },
    });
    expect(row.sellerId).toBe(other.id);
    expect(row.connectionId).toBe(conn.id);
    expect(row.externalVariantId).toBe("variant-1");
    await expect(
      importConnectedCatalog(seller, conn.id, adapter),
    ).rejects.toThrow(/Verified/);
    await setSyncPolicy(other, conn.id, "SCHEDULED", ["quantity"]);
    await pollConnectedCatalog(conn.id, adapter);
    await pollConnectedCatalog(conn.id, adapter);
    expect(
      await context.db.catalogSyncEvent.count({
        where: { connectionId: conn.id },
      }),
    ).toBe(1);
    vi.unstubAllEnvs();
  });
  it("resolves inventory conflicts only after reservations finish, then ignores older events", async () => {
    const { resolveSyncConflict } = await import("./sync");
    const event = await context.db.catalogSyncEvent.findFirstOrThrow({
      where: { eventKey: "e1" },
    });
    let listing = await context.db.listing.findUniqueOrThrow({
      where: { slug: "sync-fixture" },
    });
    await expect(
      resolveSyncConflict(seller, event.id, {
        listingUpdatedAt: listing.updatedAt.toISOString(),
        choices: { quantity: "SOURCE" },
      }),
    ).rejects.toThrow(/reserved/);
    listing = await context.db.listing.update({
      where: { id: listing.id },
      data: { status: "UNLISTED" },
    });
    await resolveSyncConflict(seller, event.id, {
      listingUpdatedAt: listing.updatedAt.toISOString(),
      choices: { quantity: "SOURCE" },
    });
    const resolved = await context.db.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(resolved.quantity).toBe(5);
    expect(resolved.status).toBe("UNLISTED");
    const older = await context.db.catalogSyncEvent.create({
      data: {
        connectionId: event.connectionId,
        eventKey: "older",
        topic: "inventory",
        productJson: JSON.stringify({
          externalProductId: "p1",
          quantity: "99",
          occurredAt: "2020-01-01T00:00:00.000Z",
        }),
      },
    });
    await applySyncEvent(older.id);
    expect(
      (
        await context.db.listing.findUniqueOrThrow({
          where: { id: listing.id },
        })
      ).quantity,
    ).toBe(5);
  });
  it("records synchronization failure and pauses affected stock without altering quantity", async () => {
    const listing = await context.db.listing.findUniqueOrThrow({
      where: { slug: "sync-fixture" },
    });
    const event = await context.db.catalogSyncEvent.create({
      data: {
        connectionId: listing.sourceConnectionId!,
        eventKey: "invalid-version",
        topic: "inventory",
        productJson: JSON.stringify({
          externalProductId: "p1",
          quantity: "10",
        }),
      },
    });
    await applySyncEvent(event.id);
    const updated = await context.db.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(updated.quantity).toBe(5);
    expect(updated.syncStatus).toBe("UNCERTAIN");
    expect(
      (
        await context.db.catalogSyncEvent.findUniqueOrThrow({
          where: { id: event.id },
        })
      ).status,
    ).toBe("FAILED");
  });
  it("disconnects credentials and retains listings", async () => {
    const { disconnectStore } = await import("./sync");
    const connection = await context.db.catalogConnection.findFirstOrThrow({
      where: { sellerId: other.id, provider: "woocommerce" },
    });
    const before = await context.db.listing.count({
      where: { sellerId: other.id },
    });
    await disconnectStore(other, connection.id);
    expect(
      (
        await context.db.catalogConnection.findUniqueOrThrow({
          where: { id: connection.id },
        })
      ).encryptedCredentials,
    ).toBeNull();
    expect(
      await context.db.listing.count({ where: { sellerId: other.id } }),
    ).toBe(before);
  });
});

describe("review queue preservation", () => {
  it("adopts existing assistant drafts in place with fresh authorization", async () => {
    const { adoptLegacyDrafts } = await import("./service");
    const row = await context.db.listingDraft.create({
      data: {
        sellerId: other.id,
        createdById: other.userId,
        title: "Previous assistant product",
        description: "Previously uploaded product description.",
        category: "flowers",
        quantity: 4,
        priceCents: 2000,
      },
    });
    const jobId = await adoptLegacyDrafts(other, true);
    const migrated = await context.db.listingDraft.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(migrated.importJobId).toBe(jobId);
    expect(migrated.id).toBe(row.id);
    expect(migrated.status).toBe("STAGED");
  });
  it("rolls back a mixed-invalid bulk approval and allows partial valid approval", async () => {
    const prepared = await prepare([
      { ...accessory, title: "Atomic approval valid", sku: "ATOMIC-VALID" },
      {
        ...accessory,
        title: "Atomic approval invalid",
        quantity: "",
        sku: "ATOMIC-INVALID",
      },
    ]);
    await expect(
      approveRows(
        seller,
        prepared.rows.map((r) => r.id),
      ),
    ).rejects.toThrow();
    expect(
      await context.db.listing.count({
        where: {
          sellerId: seller.id,
          sku: { in: ["ATOMIC-VALID", "ATOMIC-INVALID"] },
        },
      }),
    ).toBe(0);
    expect(await approveRows(seller, [prepared.rows[0].id])).toHaveLength(1);
  });
  it("restores an excluded row without making a second row", async () => {
    const row = (
      await prepare([{ ...accessory, title: "Excluded and restored" }])
    ).rows[0];
    await editRows(seller, [
      {
        id: row.id,
        version: 0,
        product: JSON.parse(row.productJson),
        resolution: "SKIP",
      },
    ]);
    await editRows(seller, [
      {
        id: row.id,
        version: 1,
        product: JSON.parse(row.productJson),
        resolution: "RESTORE",
      },
    ]);
    expect(
      (
        await context.db.listingDraft.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status,
    ).toBe("READY_FOR_APPROVAL");
  });
});

it("pauses deleted source inventory even without status sync and preserves uncertainty on disconnect", async () => {
  const { disconnectStore } = await import("./sync");
  const listing = await context.db.listing.update({
    where: { slug: "sync-fixture" },
    data: { status: "ACTIVE" },
  });
  const event = await context.db.catalogSyncEvent.create({
    data: {
      connectionId: listing.sourceConnectionId!,
      eventKey: "deleted-source",
      topic: "products/delete",
      productJson: JSON.stringify({
        externalProductId: "p1",
        status: "DELETED",
        occurredAt: "2026-09-08T00:00:00.000Z",
      }),
    },
  });
  await applySyncEvent(event.id);
  await disconnectStore(seller, listing.sourceConnectionId!);
  const paused = await context.db.listing.findUniqueOrThrow({
    where: { id: listing.id },
  });
  expect(paused.quantity).toBe(listing.quantity);
  expect(paused.status).toBe("UNLISTED");
  expect(paused.syncStatus).toBe("UNCERTAIN");
});
