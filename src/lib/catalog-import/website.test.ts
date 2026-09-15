import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import https from "node:https";
import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
const lookupAll = lookup as (
  host: string,
  options: { all: true },
) => Promise<LookupAddress[]>;
import { importWebsite, safeFetch } from "./website";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
type Reply = { status: number; body: string; type?: string; location?: string };
let replies: Reply[];
let requested: string[];
beforeEach(() => {
  replies = [];
  requested = [];
  vi.mocked(lookupAll).mockResolvedValue([
    { address: "93.184.216.34", family: 4 },
  ]);
  vi.spyOn(https, "get").mockImplementation(((
    url: URL,
    options: https.RequestOptions,
    callback: (
      response: EventEmitter & {
        statusCode: number;
        headers: Record<string, string | undefined>;
      },
    ) => void,
  ) => {
    requested.push(url.toString());
    const request = new EventEmitter() as EventEmitter & {
      destroy(error: Error): void;
    };
    request.destroy = (error: Error) => {
      request.emit("error", error);
      request.emit("close");
    };
    queueMicrotask(() => {
      const reply = replies.shift();
      if (!reply)
        return request.destroy(new Error("Unexpected network request"));
      expect(options.agent).toBe(false);
      expect(options.lookup).toBeTypeOf("function");
      const pinned = vi.fn();
      options.lookup!("catalog.example.com", { all: true }, pinned);
      expect(pinned).toHaveBeenCalledWith(null, [
        { address: "93.184.216.34", family: 4 },
      ]);
      const response = Object.assign(new EventEmitter(), {
        statusCode: reply.status,
        headers: {
          "content-type": reply.type || "text/html",
          location: reply.location,
        },
      });
      callback(response);
      response.emit("data", Buffer.from(reply.body));
      response.emit("end");
      request.emit("close");
    });
    return request;
  }) as unknown as typeof https.get);
});
afterEach(() => vi.restoreAllMocks());
describe("website fetch and extraction integration", () => {
  it("rejects DNS with even one private answer before opening a connection", async () => {
    vi.mocked(lookupAll).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      safeFetch("https://catalog.example.com/products/a"),
    ).rejects.toThrow(/DNS/);
    expect(requested).toHaveLength(0);
  });
  it("blocks redirected private addresses", async () => {
    replies.push({
      status: 302,
      body: "",
      location: "http://169.254.169.254/latest/meta-data",
    });
    await expect(
      safeFetch("https://catalog.example.com/products/a"),
    ).rejects.toThrow();
    expect(requested).toHaveLength(1);
  });
  it("bounds response bytes regardless of Content-Length", async () => {
    replies.push({ status: 200, body: "x".repeat(100) });
    await expect(
      safeFetch("https://catalog.example.com/products/a", 20),
    ).rejects.toThrow(/large/);
  });
  it("respects robots and does not fetch a disallowed product", async () => {
    replies.push({
      status: 200,
      body: "User-agent: *\nDisallow: /products/",
      type: "text/plain",
    });
    await expect(
      importWebsite("https://catalog.example.com/products/a"),
    ).rejects.toThrow(/robots/);
    expect(requested).toEqual(["https://catalog.example.com/robots.txt"]);
  });
  it("previews authorized structured website products without invented quantities", async () => {
    replies.push(
      { status: 404, body: "" },
      {
        status: 200,
        body: '<script type="application/ld+json">{"@type":"Product","name":"Seller product","description":"Seller supplied product description.","offers":{"price":"12.50","priceCurrency":"EUR"}}</script>',
      },
    );
    const products = await importWebsite(
      "https://catalog.example.com/products/a",
    );
    expect(products).toHaveLength(1);
    expect(products[0].price).toBe("12.50");
    expect(products[0].quantity).toBe("");
  });
  it("checks robots again before following a redirect", async () => {
    replies.push(
      {
        status: 200,
        body: "User-agent: *\nDisallow: /private/",
        type: "text/plain",
      },
      { status: 302, body: "", location: "/private/catalog" },
    );
    await expect(
      importWebsite("https://catalog.example.com/products/a"),
    ).rejects.toThrow(/Robots/);
    expect(requested).toHaveLength(2);
  });
});
