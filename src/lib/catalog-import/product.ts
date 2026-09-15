import { createHash } from "node:crypto";
import type { Product } from "./product-ui";
export * from "./product-ui";
export function fingerprint(p: Product) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [
          p.title,
          p.producer || p.brand,
          p.category,
          p.variant,
          p.vintage,
          p.bottleSizeMl,
        ].map((v) => (v || "").trim().toLowerCase()),
      ),
    )
    .digest("hex");
}
