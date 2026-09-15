import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Product } from "./product";
export type Provider = "shopify" | "woocommerce";
export type SyncField =
  | "price"
  | "quantity"
  | "description"
  | "images"
  | "status";
export const syncFields: SyncField[] = [
  "price",
  "quantity",
  "description",
  "images",
  "status",
];
export type CatalogEvent = {
  externalProductId: string;
  externalVariantId?: string;
  product: Product;
  deleted?: boolean;
  occurredAt: string;
};
/** An adapter must authenticate store identity before activation. It receives no orders/customer data. */
export interface CatalogAdapter {
  provider: Provider;
  verifyStore(input: {
    storeUrl: string;
    credentials: Record<string, string>;
  }): Promise<{ storeId: string; storeUrl: string }>;
  catalog(input: {
    storeId: string;
    credentials: Record<string, string>;
    cursor?: string;
  }): Promise<{ products: CatalogEvent[]; cursor?: string }>;
  revoke(credentials: Record<string, string>): Promise<void>;
  normalizeWebhook(body: unknown, topic: string): CatalogEvent[];
}
// Production adapters are deliberately not registered until OAuth/API credentials and acceptance tests exist.
export function connectorAvailability(provider: Provider) {
  const configured =
    provider === "shopify"
      ? Boolean(
          process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET,
        )
      : Boolean(process.env.WOOCOMMERCE_CONNECT_ENABLED === "true");
  return {
    provider,
    available: false,
    configured,
    reason: configured
      ? "Coming soon — production adapter authorization is not enabled"
      : "Unavailable — integration credentials are not configured",
  };
}
export function verifyWebhook(
  body: Buffer,
  signature: string | null,
  secret: string,
) {
  if (
    !secret ||
    !signature ||
    !/^[A-Za-z0-9+/]{43}=$/.test(signature) ||
    body.length > 1024 * 1024
  )
    return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function encryptionKey() {
  const key = Buffer.from(process.env.CATALOG_CREDENTIAL_KEY || "", "base64");
  if (key.length !== 32)
    throw new Error("Catalog encryption key must contain 32 bytes");
  return key;
}
export function encryptCredentials(
  value: Record<string, string>,
  connectionId: string,
) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(connectionId));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}
export function decryptCredentials(
  value: string,
  connectionId: string,
): Record<string, string> {
  const [version, nonce, tag, body] = value.split(".");
  if (version !== "v1") throw new Error("Unknown credential version");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(nonce, "base64"),
  );
  decipher.setAAD(Buffer.from(connectionId));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(body, "base64")),
      decipher.final(),
    ]).toString(),
  );
}
export function syncPlan(
  baseline: Product,
  local: Product,
  source: Product,
  allowed: SyncField[],
) {
  const updates: Product = {};
  const conflicts: string[] = [];
  for (const f of allowed) {
    if (!(f in source)) continue;
    if (
      local[f] !== baseline[f] &&
      source[f] !== baseline[f] &&
      local[f] !== source[f]
    )
      conflicts.push(f);
    else if (local[f] === baseline[f]) updates[f] = source[f];
  }
  // A source may pause or delete a product, but can never activate it.
  if (updates.status && !["UNLISTED", "DELETED"].includes(updates.status))
    delete updates.status;
  return { updates, conflicts };
}
