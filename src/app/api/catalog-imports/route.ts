import { z } from "zod";
import { requireSeller } from "@/lib/session";
import { createImport, catalogRateLimit } from "@/lib/catalog-import/service";
import { parseInventory, limits } from "@/lib/catalog-import/files";
import { importWebsite } from "@/lib/catalog-import/website";
import { boundedBody, sameOrigin } from "@/lib/catalog-import/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const { seller } = await requireSeller();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    await catalogRateLimit(`upload:${seller.id}`);
    const bytes = await boundedBody(request, limits().bytes + 65536);
    if (request.headers.get("content-type")?.startsWith("application/json")) {
      const input = z
        .object({ url: z.string().max(2000), authorized: z.literal(true) })
        .strict()
        .parse(JSON.parse(bytes.toString()));
      const rows = await importWebsite(input.url);
      const job = await createImport(seller, {
        rows,
        headers: [...new Set(rows.flatMap(Object.keys))],
        sourceType: "WEBSITE",
        sourceName: "Website catalog",
        sourceUrl: input.url,
        authorized: input.authorized,
      });
      return Response.json({ id: job.id });
    }
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: bytes,
    }).formData();
    const file = form.get("inventory");
    if (!(file instanceof File)) throw new Error("Choose a CSV or Excel file");
    if (form.get("authorized") !== "true")
      throw new Error("Content authorization required");
    const parsed = await parseInventory(
      new Uint8Array(await file.arrayBuffer()),
      file.name,
      file.type,
    );
    const job = await createImport(seller, {
      ...parsed,
      sourceName: file.name,
      authorized: true,
    });
    return Response.json({ id: job.id });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid import request"
            : e instanceof Error
              ? e.message
              : "Import unavailable",
      },
      { status: 400 },
    );
  }
}
