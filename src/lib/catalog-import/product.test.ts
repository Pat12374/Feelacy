import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import sharp from "sharp";
import {
  canonicalUrl,
  csvCell,
  fingerprint,
  mapCategory,
  mapRow,
  recognizeColumns,
  validateProduct,
} from "./product";
import { parseCsv, parseInventory, parseXlsx, scanUpload } from "./files";
import { extractProducts, publicAddress, validateUrl } from "./website";
import { validateImage } from "./images";
import {
  connectorAvailability,
  decryptCredentials,
  encryptCredentials,
  syncPlan,
  verifyWebhook,
} from "./connectors";
import { accessory, workbook } from "./fixtures";
describe("catalog parsers", () => {
  it("parses quoted commas, escaped quotes, CRLF, BOM and multiline cells", () =>
    expect(
      parseCsv('\uFEFFtitle,description\r\n"A, B","Line 1\nLine ""2"""'),
    ).toEqual([
      ["title", "description"],
      ["A, B", 'Line 1\nLine "2"'],
    ]));
  it("rejects unterminated and malformed quotes", () => {
    expect(() => parseCsv('a\n"bad')).toThrow();
    expect(() => parseCsv('a\n"bad"x')).toThrow();
  });
  it("reads XLSX cells", () =>
    expect(parseXlsx(workbook())).toEqual([
      ["title", "price"],
      ["Product", "25"],
    ]));
  it("never evaluates or trusts cached formulas", () =>
    expect(() => parseXlsx(workbook(true))).toThrow(/Formula/));
  it("rejects ZIP disguised as Excel and mismatched MIME", async () => {
    await expect(
      parseInventory(strToU8("bad"), "x.xlsx", "text/csv"),
    ).rejects.toThrow();
    expect(() =>
      parseXlsx(zipSync({ "not-a-workbook": strToU8("x") })),
    ).toThrow();
  });
  it("accepts more than 100 rows without truncation", async () => {
    const p = await parseInventory(
      strToU8(
        "title,price\n" +
          Array.from({ length: 150 }, (_, i) => `Product ${i},20`).join("\n"),
      ),
      "catalog.csv",
      "text/csv",
    );
    expect(p.rows).toHaveLength(150);
  });
  it("rejects duplicate headers and binary CSV", async () => {
    await expect(
      parseInventory(strToU8("title,title\nx,y"), "x.csv", "text/csv"),
    ).rejects.toThrow();
    await expect(
      parseInventory(new Uint8Array([0]), "x.csv", "text/csv"),
    ).rejects.toThrow();
  });
  it("fails closed when production malware scanning is absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CATALOG_SCANNER_URL", "");
    await expect(scanUpload(strToU8("x"), "text/csv")).rejects.toThrow(
      /scanner/,
    );
    vi.unstubAllEnvs();
  });
  it("honors configurable row bounds", async () => {
    vi.stubEnv("CATALOG_MAX_ROWS", "1");
    await expect(
      parseInventory(strToU8("a\nb\nc"), "x.csv", "text/csv"),
    ).rejects.toThrow();
    vi.unstubAllEnvs();
  });
});
describe("mapping and validation", () => {
  it("recognizes common platform columns", () =>
    expect(
      recognizeColumns(["Name", "Regular price", "stock_quantity", "UPC"]),
    ).toEqual({
      Name: "title",
      "Regular price": "price",
      stock_quantity: "quantity",
      UPC: "gtin",
    }));
  it("maps manually and maps categories without inventing unknowns", () => {
    expect(
      mapRow(
        { Name: "Item", Type: "Accessories" },
        { Name: "title", Type: "category" },
      ),
    ).toEqual({ title: "Item", category: "wine-accessories" });
    expect(mapCategory("unknown")).toBe("");
  });
  it("accepts non-alcohol draft while retaining compliance review", () => {
    const v = validateProduct(accessory);
    expect(v.ready).toBe(true);
    expect(v.compliance).toMatch(/safety/);
  });
  it("keeps missing quantity and price absent", () => {
    const v = validateProduct({ ...accessory, price: "", quantity: "" });
    expect(v.missing).toEqual(expect.arrayContaining(["price", "quantity"]));
  });
  it("flags category-specific alcohol information", () => {
    const v = validateProduct({ ...accessory, category: "spirits" });
    expect(v.missing).toContain("ageStatement");
    expect(v.compliance).toMatch(/Alcohol/);
  });
  it("rejects fractional inventory, unknown currency and unsupported claims", () => {
    expect(
      validateProduct({
        ...accessory,
        quantity: "1.5",
        currency: "USD",
        description: "Guaranteed investment return for your collection",
      }).errors,
    ).toHaveLength(3);
  });
  it("canonicalizes URLs and ignores tracking hashes", () =>
    expect(canonicalUrl("https://example.com/p?utm_source=x#foo")).toBe(
      "https://example.com/p",
    ));
  it("fingerprints survive price and inventory updates", () =>
    expect(fingerprint(accessory)).toBe(
      fingerprint({ ...accessory, price: "99", quantity: "0" }),
    ));
  it("neutralizes spreadsheet formulas in error exports", () =>
    expect(csvCell("=cmd()")).toBe('"\'=cmd()"'));
});
describe("website and images", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "172.16.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "100.64.0.1",
    "0.0.0.0",
  ])("blocks nonpublic address %s", (address) =>
    expect(publicAddress(address)).toBe(false),
  );
  it.each([
    "file:///etc/passwd",
    "http://localhost",
    "http://127.1",
    "http://2130706433",
    "https://a:b@example.com",
    "https://example.com:8443",
  ])("rejects unsafe URL %s", (url) =>
    expect(() => validateUrl(url)).toThrow(),
  );
  it("accepts public IP and URL", () => {
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(validateUrl("https://example.com/products/item").hostname).toBe(
      "example.com",
    );
  });
  it("extracts only structured product facts, never availability as quantity", () => {
    const p = extractProducts(
      '<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Bottle","offers":{"price":"20.00","priceCurrency":"EUR","availability":"InStock"}}]}</script>',
      "https://example.com/p",
    )[0];
    expect(p.price).toBe("20.00");
    expect(p.quantity).toBe("");
    expect(p.category).toBe("");
  });
  it("validates decoded image signature and dimensions", async () => {
    const b = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(validateImage(b, "image/png")).resolves.toBeInstanceOf(Buffer);
    await expect(validateImage(b, "image/jpeg")).rejects.toThrow();
    await expect(
      validateImage(Buffer.from("<svg/>"), "image/svg+xml"),
    ).rejects.toThrow();
  });
});
describe("connector security and synchronization", () => {
  it.each(["shopify", "woocommerce"] as const)(
    "verifies %s HMAC and rejects tampering",
    (provider) => {
      const b = Buffer.from('{"id":1}');
      const signature = createHmac("sha256", "secret")
        .update(b)
        .digest("base64");
      expect(verifyWebhook(b, signature, "secret")).toBe(true);
      expect(verifyWebhook(Buffer.from("changed"), signature, "secret")).toBe(
        false,
      );
      expect(connectorAvailability(provider).available).toBe(false);
    },
  );
  it("authenticates encrypted credentials against the connection identity", () => {
    vi.stubEnv(
      "CATALOG_CREDENTIAL_KEY",
      Buffer.alloc(32, 1).toString("base64"),
    );
    const encrypted = encryptCredentials({ token: "secret" }, "a");
    expect(encrypted).not.toContain("secret");
    expect(decryptCredentials(encrypted, "a")).toEqual({ token: "secret" });
    expect(() => decryptCredentials(encrypted, "b")).toThrow();
    vi.unstubAllEnvs();
  });
  it("detects conflicts and preserves seller edits", () => {
    expect(
      syncPlan({ price: "10" }, { price: "12" }, { price: "11" }, ["price"]),
    ).toEqual({ updates: {}, conflicts: ["price"] });
    expect(
      syncPlan({ price: "10" }, { price: "12" }, { price: "10" }, ["price"])
        .updates,
    ).toEqual({});
  });
  it("never automatically activates a listing", () =>
    expect(
      syncPlan({ status: "DRAFT" }, { status: "DRAFT" }, { status: "ACTIVE" }, [
        "status",
      ]).updates,
    ).toEqual({}));
  it("does not sync fields without consent", () =>
    expect(
      syncPlan({ price: "10" }, { price: "10" }, { price: "12" }, []).updates,
    ).toEqual({}));
});

describe("bounded request handling", () => {
  it("checks actual body size, not only Content-Length", async () => {
    const { boundedBody } = await import("./http");
    const request = new Request("https://feelacy.example/api", {
      method: "POST",
      body: "oversized",
    });
    await expect(boundedBody(request, 3)).rejects.toThrow(/large/);
  });
  it("uses the trusted public origin behind a reverse proxy", async () => {
    const { sameOrigin } = await import("./http");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://feelacy.example");
    expect(
      sameOrigin(
        new Request("http://internal:3000/api", {
          headers: { origin: "https://feelacy.example" },
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request("http://internal:3000/api", {
          headers: {
            origin: "https://attacker.example",
            "x-forwarded-host": "attacker.example",
          },
        }),
      ),
    ).toBe(false);
    vi.unstubAllEnvs();
  });
});
