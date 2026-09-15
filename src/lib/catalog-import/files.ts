import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type { Product } from "./product";
export function limits() {
  const bounded = (name: string, fallback: number, max: number) =>
    Math.floor(
      Math.min(max, Math.max(1, Number(process.env[name]) || fallback)),
    );
  return {
    rows: bounded("CATALOG_MAX_ROWS", 10000, 50000),
    bytes: bounded(
      "CATALOG_MAX_FILE_BYTES",
      10 * 1024 * 1024,
      25 * 1024 * 1024,
    ),
    batch: bounded("CATALOG_BATCH_SIZE", 25, 100),
  };
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === '"' && !value && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed || c === '"') throw new Error("Malformed CSV quoting");
      value += c;
    }
    if (value.length > 10000 || row.length > 100 || rows.length > limits().rows)
      throw new Error("File exceeds row, column or cell limits");
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
const array = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
export function parseXlsx(bytes: Uint8Array): string[][] {
  let expanded = 0;
  let count = 0;
  const zip = unzipSync(bytes, {
    filter: (f) => {
      expanded += f.originalSize;
      if (
        ++count > 2000 ||
        expanded > 40 * 1024 * 1024 ||
        /vbaProject|externalLinks/i.test(f.name)
      )
        throw new Error("Unsafe or oversized workbook");
      return /^(\[Content_Types\]\.xml|xl\/(workbook\.xml|sharedStrings\.xml|worksheets\/sheet1\.xml))$/.test(
        f.name,
      );
    },
  });
  if (
    !zip["[Content_Types].xml"] ||
    !zip["xl/workbook.xml"] ||
    !zip["xl/worksheets/sheet1.xml"]
  )
    throw new Error("Invalid XLSX workbook");
  const xml = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: false,
  });
  const read = (name: string) => {
    const s = zip[name] ? strFromU8(zip[name]) : "";
    if (/<!DOCTYPE|<!ENTITY/i.test(s))
      throw new Error("XML entities are forbidden");
    return xml.parse(s);
  };
  const shared = array<{ t?: string; r?: { t: string }[] }>(
    read("xl/sharedStrings.xml")?.sst?.si,
  ).map(
    (s) =>
      s.t ||
      array(s.r)
        .map((r) => r.t)
        .join(""),
  );
  const sheet = read("xl/worksheets/sheet1.xml");
  return array<{
    c?: {
      "@_r": string;
      "@_t"?: string;
      v?: string;
      f?: unknown;
      is?: { t?: string };
    }[];
  }>(sheet?.worksheet?.sheetData?.row).map((r) => {
    const row: string[] = [];
    for (const c of array(r.c)) {
      const letters = String(c["@_r"] || "").match(/^[A-Z]+/)?.[0];
      if (!letters) throw new Error("Invalid cell reference");
      const index =
        [...letters].reduce((n, x) => n * 26 + x.charCodeAt(0) - 64, 0) - 1;
      if (index > 99) throw new Error("Too many columns");
      if (c.f !== undefined)
        throw new Error("Formula cells are unsupported; export values only");
      row[index] =
        c["@_t"] === "s"
          ? shared[Number(c.v)] || ""
          : c["@_t"] === "inlineStr"
            ? c.is?.t || ""
            : String(c.v || "");
    }
    return Array.from({ length: row.length }, (_, i) => row[i] || "");
  });
}
export async function scanUpload(bytes: Uint8Array, mime: string) {
  const endpoint = process.env.CATALOG_SCANNER_URL;
  const required =
    process.env.NODE_ENV === "production" ||
    process.env.CATALOG_SCAN_REQUIRED === "true";
  if (!endpoint) {
    if (required) throw new Error("Malware scanner unavailable");
    return;
  }
  const u = new URL(endpoint);
  if (u.protocol !== "https:") throw new Error("Scanner must use HTTPS");
  const response = await fetch(u, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": mime,
      Authorization: `Bearer ${process.env.CATALOG_SCANNER_TOKEN || ""}`,
    },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || (await response.json()).status !== "clean")
    throw new Error("Upload could not be verified clean");
}
export async function parseInventory(
  bytes: Uint8Array,
  name: string,
  mime: string,
): Promise<{ headers: string[]; rows: Product[]; sourceType: string }> {
  if (!bytes.length || bytes.length > limits().bytes)
    throw new Error("File exceeds configured size limit");
  const excel = name.toLowerCase().endsWith(".xlsx");
  if (
    excel
      ? mime !==
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        bytes[0] !== 0x50 ||
        bytes[1] !== 0x4b ||
        bytes[2] !== 3 ||
        bytes[3] !== 4
      : !name.toLowerCase().endsWith(".csv") ||
        ![
          "text/csv",
          "application/csv",
          "text/plain",
          "application/vnd.ms-excel",
        ].includes(mime) ||
        bytes.includes(0)
  )
    throw new Error("File signature, extension or MIME type is invalid");
  await scanUpload(bytes, mime);
  const table = excel
    ? parseXlsx(bytes)
    : parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const headers = table.shift()?.map((h) => h.trim());
  if (
    !headers?.length ||
    headers.some((h) => !h || h.length > 200) ||
    new Set(headers).size !== headers.length ||
    headers.length > 100 ||
    !table.length ||
    table.length > limits().rows
  )
    throw new Error("Invalid headers, empty file or too many rows");
  if (
    table.some(
      (r) => r.length > headers.length || r.some((c) => c.length > 10000),
    )
  )
    throw new Error("Invalid row width or cell size");
  return {
    headers,
    rows: table.map((r) =>
      Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])),
    ),
    sourceType: excel ? "XLSX" : "CSV",
  };
}
