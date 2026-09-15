import { z } from "zod";

export const categories = [
  "wine",
  "spirits",
  "flowers",
  "wine-accessories",
] as const;
export const categoryFields: Record<string, string[]> = {
  wine: [
    "producer",
    "wineType",
    "country",
    "region",
    "vintage",
    "bottleSizeMl",
    "abv",
    "grapeVariety",
    "condition",
    "provenance",
    "caseQuantity",
  ],
  spirits: [
    "producer",
    "spiritCategory",
    "country",
    "region",
    "ageStatement",
    "bottleSizeMl",
    "abv",
    "edition",
    "condition",
    "provenance",
  ],
  flowers: [
    "arrangementType",
    "flowerVarieties",
    "colors",
    "size",
    "freshnessPeriod",
    "deliveryDateOptions",
    "deliveryArea",
    "substitutionPolicy",
  ],
  "wine-accessories": [
    "accessoryType",
    "brand",
    "materials",
    "dimensions",
    "compatibility",
    "safetyInformation",
    "warranty",
    "returnsRules",
  ],
};
export const fields = [
  ...new Set([
    "title",
    "description",
    "category",
    "price",
    "currency",
    "sku",
    "gtin",
    "quantity",
    "producer",
    "sourceUrl",
    "imageUrls",
    "weightGrams",
    "lengthCm",
    "widthCm",
    "heightCm",
    "variant",
    "externalProductId",
    "externalVariantId",
    ...Object.values(categoryFields).flat(),
  ]),
];
export type Product = Record<string, string>;
export type Mapping = Record<string, string>;
export const productSchema = z
  .record(z.string().max(80), z.string().max(10000))
  .refine(
    (p) => Object.keys(p).every((k) => fields.includes(k)),
    "Unknown field",
  );
export const mappingSchema = z
  .record(z.string().max(200), z.enum(["", ...fields] as [string, ...string[]]))
  .refine((m) => {
    const targets = Object.values(m).filter(Boolean);
    return new Set(targets).size === targets.length;
  }, "Map each field only once");
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  title: ["name", "product", "productname"],
  price: ["unitprice", "regularprice", "variantprice"],
  quantity: [
    "qty",
    "stock",
    "inventory",
    "stockquantity",
    "variantinventoryqty",
  ],
  gtin: ["upc", "barcode", "ean", "variantbarcode"],
  sku: ["variantsku"],
  sourceUrl: ["url", "producturl", "link"],
  imageUrls: ["images", "image", "imageurl", "imagesrc"],
  externalProductId: ["id", "productid"],
  description: ["bodyhtml", "body", "productdescription"],
};
export function recognizeColumns(headers: string[]): Mapping {
  const used = new Set<string>();
  return Object.fromEntries(
    headers.map((h) => {
      const n = normalize(h);
      const target = fields.find(
        (f) => normalize(f) === n || aliases[f]?.includes(n),
      );
      if (!target || used.has(target)) return [h, ""];
      used.add(target);
      return [h, target];
    }),
  );
}
export function mapCategory(raw: string) {
  const n = normalize(raw);
  return (
    (
      {
        wine: "wine",
        wines: "wine",
        redwine: "wine",
        whitewine: "wine",
        spirits: "spirits",
        spirit: "spirits",
        whisky: "spirits",
        whiskey: "spirits",
        flowers: "flowers",
        flower: "flowers",
        bouquet: "flowers",
        wineaccessories: "wine-accessories",
        accessories: "wine-accessories",
      } as Record<string, string>
    )[n] || ""
  );
}
export function mapRow(raw: Product, mapping: Mapping): Product {
  const p: Product = {};
  for (const [h, f] of Object.entries(mapping))
    if (f && fields.includes(f)) p[f] = (raw[h] || "").trim();
  p.category = mapCategory(p.category || "");
  return p;
}
export function canonicalUrl(raw: string) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Invalid product URL");
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  if (u.toString().length > 2000) throw new Error("Product URL is too long");
  return u.toString();
}
export function validateProduct(p: Product) {
  const errors: string[] = [];
  const missing: string[] = [];
  for (const f of [
    "title",
    "description",
    "category",
    "price",
    "currency",
    "quantity",
    ...(categoryFields[p.category] || []),
  ])
    if (!p[f]?.trim()) missing.push(f);
  for (const [key, max] of [
    ["sku", 128],
    ["externalProductId", 200],
    ["externalVariantId", 200],
  ] as const)
    if (p[key]?.length > max)
      errors.push(`${key} must contain at most ${max} characters`);
  if (p.title && (p.title.length < 3 || p.title.length > 160))
    errors.push("Title must contain 3–160 characters");
  if (
    p.description &&
    (p.description.length < 20 || p.description.length > 10000)
  )
    errors.push("Description must contain 20–10,000 characters");
  if (
    p.category &&
    !categories.includes(p.category as (typeof categories)[number])
  )
    errors.push("Unsupported category");
  if (
    p.price &&
    (!/^\d+(\.\d{1,2})?$/.test(p.price) ||
      Number(p.price) < 1 ||
      Number(p.price) > 100000)
  )
    errors.push("Price must be 1–100,000 with at most two decimals");
  if (p.currency && p.currency.toLowerCase() !== "eur")
    errors.push("Only EUR is currently supported by checkout");
  if (p.quantity && (!/^\d+$/.test(p.quantity) || Number(p.quantity) > 1000000))
    errors.push("Quantity must be an integer between 0 and 1,000,000");
  if ((p.imageUrls || "").split(/[|\n]/).filter(Boolean).length > 8)
    errors.push("At most eight product images are supported");
  if (p.gtin && !/^\d{8}$|^\d{12,14}$/.test(p.gtin))
    errors.push("UPC/GTIN must contain 8 or 12–14 digits");
  if (p.gtin && /^(\d{8}|\d{12,14})$/.test(p.gtin)) {
    const sum = [...p.gtin.slice(0, -1)]
      .reverse()
      .reduce((n, digit, i) => n + Number(digit) * (i % 2 === 0 ? 3 : 1), 0);
    if ((10 - (sum % 10)) % 10 !== Number(p.gtin.at(-1)))
      errors.push("UPC/GTIN check digit is invalid");
  }
  for (const f of [
    "abv",
    "bottleSizeMl",
    "weightGrams",
    "lengthCm",
    "widthCm",
    "heightCm",
    "caseQuantity",
  ])
    if (
      p[f] &&
      (!/^\d+(\.\d+)?$/.test(p[f]) ||
        Number(p[f]) > (f === "abv" ? 100 : 1000000))
    )
      errors.push(`Invalid ${f}`);
  if (p.vintage && !/^(19|20)\d{2}$|^NV$/i.test(p.vintage))
    errors.push("Vintage must be a year or NV; leave unknown values blank");
  for (const value of [
    p.sourceUrl,
    ...(p.imageUrls || "").split(/[|\n]/),
  ].filter(Boolean))
    try {
      canonicalUrl(value);
    } catch {
      errors.push("Invalid source or image URL");
    }
  if (
    /guaranteed\s+(authentic|investment|return)|cures?\s+|treats?\s+(disease|cancer)/i.test(
      p.description || "",
    )
  )
    errors.push("Unsupported product claim requires review");
  return {
    errors,
    missing,
    ready: !errors.length && !missing.length,
    confidence: Math.max(0, 1 - (errors.length + missing.length) / 15),
    compliance: ["wine", "spirits"].includes(p.category)
      ? "Alcohol eligibility review required"
      : "Product safety, tax, shipping and returns review required",
  };
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
