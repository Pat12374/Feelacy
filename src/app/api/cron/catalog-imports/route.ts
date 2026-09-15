import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { applySyncEvent } from "@/lib/catalog-import/sync";
import { processBatch } from "@/lib/catalog-import/service";
export const maxDuration = 120;
export async function POST(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ""}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (
    !process.env.CRON_SECRET ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = await prisma.catalogImportJob.findMany({
    where: {
      status: { in: ["QUEUED", "RUNNING"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  for (const job of jobs) await processBatch(job.id);
  const events = await prisma.catalogSyncEvent.findMany({
    where: {
      status: "QUEUED",
      connection: { status: "ACTIVE", mode: { in: ["SCHEDULED", "LIVE"] } },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  for (const event of events) await applySyncEvent(event.id);
  return Response.json({
    processed: jobs.length,
    synchronizationEvents: events.length,
  });
}
