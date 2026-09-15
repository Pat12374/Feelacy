import { z } from "zod";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import { boundedBody, sameOrigin } from "@/lib/catalog-import/http";
import { catalogRateLimit } from "@/lib/catalog-import/service";
import {
  disconnectStore,
  resolveSyncConflict,
} from "@/lib/catalog-import/sync";
import { setSyncPolicy } from "@/lib/catalog-import/connections";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disconnect") }),
  z.object({
    action: z.literal("policy"),
    mode: z.enum(["ONE_TIME", "SCHEDULED", "LIVE"]),
    fields: z
      .array(z.enum(["price", "quantity", "description", "images", "status"]))
      .max(5),
  }),
  z.object({
    action: z.literal("resolve"),
    eventId: z.string(),
    listingUpdatedAt: z.iso.datetime(),
    choices: z.record(z.string(), z.enum(["LOCAL", "SOURCE"])),
  }),
]);
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { seller } = await requireSeller();
  const { id } = await context.params;
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (
    !(await prisma.catalogConnection.findFirst({
      where: { id, sellerId: seller.id },
    }))
  )
    return Response.json({ error: "Connection not found" }, { status: 404 });
  try {
    await catalogRateLimit(`connection:${seller.id}`, 100);
    const input = schema.parse(
      JSON.parse((await boundedBody(request, 16384)).toString()),
    );
    if (input.action === "disconnect") await disconnectStore(seller, id);
    else if (input.action === "policy")
      await setSyncPolicy(seller, id, input.mode, input.fields);
    else {
      if (
        !(await prisma.catalogSyncEvent.findFirst({
          where: { id: input.eventId, connectionId: id },
        }))
      )
        throw new Error("Conflict unavailable");
      await resolveSyncConflict(seller, input.eventId, input);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid connection request"
            : e instanceof Error
              ? e.message
              : "Operation failed",
      },
      { status: 400 },
    );
  }
}
