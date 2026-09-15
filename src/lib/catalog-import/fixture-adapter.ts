import type { CatalogAdapter, CatalogEvent, Provider } from "./connectors";
import { accessory } from "./fixtures";
/** Deterministic adapter for tests only. Never reachable through live connection routes. */
export function fixtureAdapter(provider: Provider): CatalogAdapter {
  const products: CatalogEvent[] = [
    {
      externalProductId: `${provider}-product-1`,
      externalVariantId: "variant-1",
      occurredAt: "2026-09-07T00:00:00.000Z",
      product: {
        ...accessory,
        externalProductId: `${provider}-product-1`,
        externalVariantId: "variant-1",
        sku: "FIXTURE-1",
      },
    },
  ];
  return {
    provider,
    async verifyStore(input) {
      if (
        input.credentials.token !== "fixture-only" ||
        new URL(input.storeUrl).origin !== "https://fixture.example.com"
      )
        throw new Error("Fixture authorization failed");
      return { storeId: "fixture-store", storeUrl: input.storeUrl };
    },
    async catalog() {
      return { products };
    },
    async revoke() {},
    normalizeWebhook() {
      return products;
    },
  };
}
