import { z } from "zod";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  approveRows,
  catalogRateLimit,
  changeJob,
  editRows,
  processBatch,
  setMapping,
} from "@/lib/catalog-import/service";
import {
  csvCell,
  mappingSchema,
  productSchema,
} from "@/lib/catalog-import/product";
import { boundedBody, sameOrigin } from "@/lib/catalog-import/http";
export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Context) {
  const { seller } = await requireSeller();
  const { id } = await ctx.params;
  const job = await prisma.catalogImportJob.findFirst({
    where: { id, sellerId: seller.id },
  });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const url = new URL(request.url);
  const skip = Math.min(
    50000,
    Math.max(0, Number(url.searchParams.get("offset")) || 0),
  );
  const exportErrors = url.searchParams.get("errors") === "1";
  const rows = await prisma.listingDraft.findMany({
    where: { sellerId: seller.id, importJobId: id },
    orderBy: { rowNumber: "asc" },
    ...(exportErrors ? {} : { skip, take: 100 }),
  });
  if (exportErrors)
    return new Response(
      [
        ["Row", "Title", "Missing fields", "Errors", "Duplicate", "Status"],
        ...rows
          .filter(
            (r) =>
              r.missingFieldsCsv ||
              r.validationErrorsJson !== "[]" ||
              r.duplicateDraftId ||
              r.duplicateListingId,
          )
          .map((r) => [
            r.rowNumber,
            r.title,
            r.missingFieldsCsv,
            r.validationErrorsJson,
            r.duplicateListingId || r.duplicateDraftId,
            r.status,
          ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="catalog-errors.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  return Response.json(
    { job, rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
const operation = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("map"),
    mapping: mappingSchema,
    templateName: z.string().max(80).optional(),
  }),
  z.object({ action: z.enum(["cancel", "retry", "process"]) }),
  z.object({
    action: z.literal("approve"),
    ids: z.array(z.string()).min(1).max(100),
  }),
  z.object({
    action: z.literal("edit"),
    edits: z
      .array(
        z.object({
          id: z.string(),
          version: z.number().int().nonnegative(),
          product: productSchema,
          resolution: z
            .enum(["SKIP", "SEPARATE", "UPDATE_DRAFT", "MERGE", "RESTORE"])
            .optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
]);
export async function POST(request: Request, ctx: Context) {
  const { seller } = await requireSeller();
  const { id } = await ctx.params;
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const job = await prisma.catalogImportJob.findFirst({
    where: { id, sellerId: seller.id },
  });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    await catalogRateLimit(`operations:${seller.id}`, 500);
    const input = operation.parse(
      JSON.parse((await boundedBody(request, 2 * 1024 * 1024)).toString()),
    );
    if (input.action === "map")
      await setMapping(seller, id, input.mapping, input.templateName);
    else if (input.action === "process") await processBatch(id, seller.id);
    else if (input.action === "cancel" || input.action === "retry")
      await changeJob(seller, id, input.action);
    else if (input.action === "approve" || input.action === "edit") {
      const ids =
        input.action === "approve" ? input.ids : input.edits.map((e) => e.id);
      if (
        (await prisma.listingDraft.count({
          where: { id: { in: ids }, sellerId: seller.id, importJobId: id },
        })) !== new Set(ids).size
      )
        throw new Error("Rows unavailable");
      if (input.action === "approve") await approveRows(seller, input.ids);
      else await editRows(seller, input.edits);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid request"
            : e instanceof Error
              ? e.message
              : "Operation failed",
      },
      { status: 400 },
    );
  }
}
