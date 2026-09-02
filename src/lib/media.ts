import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

export function mediaConfigured() {
  return Boolean(
    process.env.MEDIA_BUCKET &&
      process.env.MEDIA_ENDPOINT &&
      process.env.MEDIA_PUBLIC_URL &&
      process.env.MEDIA_ACCESS_KEY_ID &&
      process.env.MEDIA_SECRET_ACCESS_KEY,
  );
}

export async function createListingUpload(input: {
  contentType: string;
  size: number;
}) {
  if (!mediaConfigured()) throw new Error("Media storage is not configured");
  if (!ALLOWED_TYPES.has(input.contentType) || input.size > MAX_MEDIA_BYTES) {
    throw new Error("Unsupported image");
  }
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1];
  const key = `listings/${new Date().toISOString().slice(0, 10)}/${nanoid()}.${extension}`;
  const client = new S3Client({
    region: process.env.MEDIA_REGION || "auto",
    endpoint: process.env.MEDIA_ENDPOINT,
    forcePathStyle: process.env.MEDIA_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.MEDIA_ACCESS_KEY_ID!,
      secretAccessKey: process.env.MEDIA_SECRET_ACCESS_KEY!,
    },
  });
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET!,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
    }),
    { expiresIn: 300 },
  );
  return {
    uploadUrl,
    publicUrl: `${process.env.MEDIA_PUBLIC_URL!.replace(/\/$/, "")}/${key}`,
  };
}
