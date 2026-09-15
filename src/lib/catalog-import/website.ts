import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";
import { XMLParser } from "fast-xml-parser";
import { canonicalUrl, type Product } from "./product";
export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function validateUrl(raw: string) {
  const u = new URL(canonicalUrl(raw));
  if (
    u.port ||
    !u.hostname.includes(".") ||
    /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname) ||
    u.hostname.endsWith(".")
  )
    throw new Error("Unsafe website URL");
  if (
    ipaddr.isValid(u.hostname.replace(/^\[|\]$/g, "")) &&
    !publicAddress(u.hostname.replace(/^\[|\]$/g, ""))
  )
    throw new Error("Private address forbidden");
  return u;
}
export async function safeFetch(
  raw: string,
  maxBytes = 2 * 1024 * 1024,
  origin?: string,
  redirects = 0,
  permitted?: (url: string) => boolean,
): Promise<{ bytes: Buffer; type: string; status: number; url: string }> {
  const u = validateUrl(raw);
  if (permitted && !permitted(u.toString()))
    throw new Error("Robots restrictions prohibit this URL");
  if (origin && u.origin !== origin)
    throw new Error("Cross-origin crawling forbidden");
  let dnsTimer: ReturnType<typeof setTimeout>;
  const dnsDeadline = new Promise<never>((_, reject) => {
    dnsTimer = setTimeout(() => reject(new Error("DNS lookup timeout")), 10000);
  });
  const addresses = await Promise.race([
    lookup(u.hostname, { all: true }),
    dnsDeadline,
  ]).finally(() => clearTimeout(dnsTimer!));
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Unsafe DNS address");
  // Pin the validated address into the connection, retaining the original TLS hostname.
  const a = addresses[0];
  const result = await new Promise<{
    bytes: Buffer;
    type: string;
    status: number;
    location?: string;
  }>((resolve, reject) => {
    const req = (u.protocol === "https:" ? https : http).get(
      u,
      {
        agent: false,
        headers: {
          "User-Agent": "FEELACY-Catalog/1.0",
          "Accept-Encoding": "identity",
        },
        lookup: (_host, options, cb) => {
          if (options.all) cb(null, [a]);
          else cb(null, a.address, a.family);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) req.destroy(new Error("Response too large"));
          else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            bytes: Buffer.concat(chunks),
            type: String(res.headers["content-type"] || "").split(";")[0],
            status: res.statusCode || 500,
            location: res.headers.location,
          }),
        );
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Website timeout")),
      10000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
  });
  if ([301, 302, 303, 307, 308].includes(result.status)) {
    if (++redirects > 3 || !result.location) throw new Error("Redirect limit");
    return safeFetch(
      new URL(result.location, u).toString(),
      maxBytes,
      origin || u.origin,
      redirects,
      permitted,
    );
  }
  return { ...result, url: u.toString() };
}
export function extractProducts(html: string, source: string): Product[] {
  const result: Product[] = [];
  function visit(node: unknown, depth = 0) {
    if (depth > 20 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.slice(0, 10000).forEach((n) => visit(n, depth + 1));
      return;
    }
    const n = node as Record<string, unknown>;
    const types = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]];
    if (types.includes("Product")) {
      const offer = (Array.isArray(n.offers) ? n.offers[0] : n.offers) as
        | Record<string, unknown>
        | undefined;
      const str = (v: unknown) =>
        typeof v === "string" || typeof v === "number"
          ? String(v).slice(0, 10000)
          : "";
      const brand = n.brand as { name?: string } | undefined;
      const images = (Array.isArray(n.image) ? n.image : [n.image])
        .map((i) =>
          str(typeof i === "object" && i ? (i as { url?: unknown }).url : i),
        )
        .filter(Boolean)
        .slice(0, 8);
      result.push({
        title: str(n.name),
        description: str(n.description).replace(/<[^>]*>/g, ""),
        category: str(n.category),
        price: str(offer?.price),
        currency: str(offer?.priceCurrency),
        quantity: "",
        sku: str(n.sku),
        gtin: str(n.gtin || n.gtin13 || n.gtin12),
        producer: str(brand?.name),
        sourceUrl: str(n.url) ? new URL(str(n.url), source).toString() : source,
        imageUrls: images.map((i) => new URL(i, source).toString()).join("|"),
        externalProductId: str(n.productID),
      });
    }
    for (const [key, value] of Object.entries(n))
      if (
        [
          "@graph",
          "itemListElement",
          "item",
          "mainEntity",
          "hasVariant",
        ].includes(key)
      )
        visit(value, depth + 1);
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      /* Invalid structured data stays absent. */
    }
  }
  return result;
}
export async function importWebsite(raw: string): Promise<Product[]> {
  const u = validateUrl(raw);
  const robots = await safeFetch(
    new URL("/robots.txt", u).toString(),
    256000,
    u.origin,
  );
  if (robots.status !== 200 && robots.status !== 404)
    throw new Error("Robots policy unavailable");
  const policy = robotsParser(
    new URL("/robots.txt", u).toString(),
    robots.status === 404 ? "" : robots.bytes.toString(),
  );
  const delay = policy.getCrawlDelay("FEELACY-Catalog") || 1;
  if (delay > 5)
    throw new Error("Site requires slower crawling; use a file export");
  const started = Date.now();
  const queue = [u.toString()];
  const seen = new Set<string>();
  const products: Product[] = [];
  while (queue.length && seen.size < 20 && Date.now() - started < 60000) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    if (policy.isAllowed(url, "FEELACY-Catalog") === false)
      throw new Error("Website robots restrictions prohibit import");
    if (seen.size > 1) await new Promise((r) => setTimeout(r, delay * 1000));
    const response = await safeFetch(
      url,
      undefined,
      u.origin,
      0,
      (target) => policy.isAllowed(target, "FEELACY-Catalog") !== false,
    );
    if (response.status !== 200)
      throw new Error("Website unavailable or access restricted");
    const body = response.bytes.toString();
    if (response.type.includes("xml")) {
      if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new Error("Unsafe sitemap");
      const xml = new XMLParser({ processEntities: false }).parse(body);
      const entries = xml?.urlset?.url || xml?.sitemapindex?.sitemap || [];
      for (const entry of Array.isArray(entries) ? entries : [entries])
        if (typeof entry.loc === "string") {
          const next = validateUrl(entry.loc);
          if (
            next.origin === u.origin &&
            (/\/products?\//.test(next.pathname) ||
              next.pathname.endsWith(".xml"))
          )
            queue.push(next.toString());
        }
    } else if (
      response.type === "text/html" ||
      response.type === "application/xhtml+xml"
    ) {
      products.push(...extractProducts(body, response.url));
      // Only product paths on the authorized origin, never arbitrary navigation links.
      for (const m of body.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
        if (queue.length >= 100) break;
        try {
          const next = validateUrl(new URL(m[1], response.url).toString());
          if (next.origin === u.origin && /\/products?\//.test(next.pathname))
            queue.push(next.toString());
        } catch {
          /* Ignore unrelated or unsafe navigation. */
        }
      }
    } else throw new Error("Use an HTML product page or XML sitemap");
    if (products.length > 1000)
      throw new Error("Website exceeds preview limit; use a file export");
  }
  if (!products.length)
    throw new Error(
      "No structured products found; upload a CSV or Excel export",
    );
  return products;
}
