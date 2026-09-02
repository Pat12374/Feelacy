const ALLOWED_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
]);

try {
  if (process.env.MEDIA_PUBLIC_URL) {
    ALLOWED_IMAGE_HOSTS.add(new URL(process.env.MEDIA_PUBLIC_URL).hostname);
  }
} catch {
  // Production environment validation reports malformed media configuration.
}

/** Only allow HTTPS images from an explicit host allowlist (or our own uploads later). */
export function sanitizeListingImageUrl(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!ALLOWED_IMAGE_HOSTS.has(url.hostname)) return null;
  // Block credentials / odd ports
  if (url.username || url.password) return null;
  return url.toString();
}

export const LISTING_PRICE_MIN_CENTS = 100; // €1
export const LISTING_PRICE_MAX_CENTS = 10_000_000; // €100,000
