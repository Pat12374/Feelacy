export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request body timeout")), 15000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("Request too large");
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer!);
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

export function sameOrigin(request: Request) {
  // A reverse proxy can give request.url an internal host. Trust the configured
  // public origin, never an arbitrary forwarded-host header.
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL;
  return (
    request.headers.get("origin") === new URL(configured || request.url).origin
  );
}
