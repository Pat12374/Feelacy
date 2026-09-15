import { connectorAvailability } from "@/lib/catalog-import/connectors";
/** Reserved endpoint: do not accept or acknowledge live events without an authorized adapter. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ provider: string; connectionId: string }> },
) {
  const { provider } = await context.params;
  if (provider !== "shopify" && provider !== "woocommerce")
    return Response.json({ error: "Unknown provider" }, { status: 404 });
  return Response.json(
    { error: connectorAvailability(provider).reason },
    { status: 503 },
  );
}
