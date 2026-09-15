import sharp from "sharp";
import robotsParser from "robots-parser";
import { createHash } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mediaConfigured, MAX_MEDIA_BYTES } from "@/lib/media";
import { safeFetch, validateUrl } from "./website";
export async function validateImage(bytes: Buffer, mime: string) {
  if (
    !bytes.length ||
    bytes.length > MAX_MEDIA_BYTES ||
    !["image/jpeg", "image/png", "image/webp"].includes(mime)
  )
    throw new Error("Unsupported image type or size");
  const metadata = await sharp(bytes, {
    limitInputPixels: 40000000,
  }).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 32 ||
    metadata.height < 32 ||
    metadata.width > 10000 ||
    metadata.height > 10000 ||
    (metadata.pages || 1) > 1 ||
    `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}` !== mime
  )
    throw new Error("Invalid image signature or dimensions");
  return sharp(bytes, { limitInputPixels: 40000000 })
    .rotate()
    .webp({ quality: 85 })
    .toBuffer();
}
export async function copyProductImage(
  raw: string,
  sellerId: string,
  authorized: boolean,
) {
  if (!authorized) throw new Error("Image content authorization required");
  if (!mediaConfigured())
    throw new Error(
      "Media storage unavailable; upload an image in the listing editor",
    );
  const source = validateUrl(raw);
  const robotsUrl = new URL("/robots.txt", source).toString();
  const robots = await safeFetch(robotsUrl, 256000, source.origin);
  if (![200, 404].includes(robots.status))
    throw new Error("Image source policy unavailable");
  const policy = robotsParser(
    robotsUrl,
    robots.status === 404 ? "" : robots.bytes.toString(),
  );
  if (policy.isAllowed(raw, "FEELACY-Catalog") === false)
    throw new Error("Image source prohibits crawling");
  const delay = policy.getCrawlDelay("FEELACY-Catalog") || 0;
  if (delay > 5)
    throw new Error("Image source requires slower access; upload manually");
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  const fetched = await safeFetch(
    raw,
    MAX_MEDIA_BYTES,
    source.origin,
    0,
    (target) => policy.isAllowed(target, "FEELACY-Catalog") !== false,
  );
  if (fetched.status !== 200) throw new Error("Image unavailable");
  const bytes = await validateImage(fetched.bytes, fetched.type);
  const key = `listings/imports/${sellerId}/${createHash("sha256").update(bytes).digest("hex")}.webp`;
  const client = new S3Client({
    region: process.env.MEDIA_REGION || "auto",
    endpoint: process.env.MEDIA_ENDPOINT,
    forcePathStyle: process.env.MEDIA_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.MEDIA_ACCESS_KEY_ID!,
      secretAccessKey: process.env.MEDIA_SECRET_ACCESS_KEY!,
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET!,
      Key: key,
      Body: bytes,
      ContentType: "image/webp",
    }),
    { abortSignal: AbortSignal.timeout(10000) },
  );
  return `${process.env.MEDIA_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}
