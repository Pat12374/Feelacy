import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { MarketplaceAssistant } from "@/components/marketplace-assistant";
export const metadata = { title: "Seller Listing Assistant" };
export default async function SellerAssistantPage() {
  await requireSeller();
  return (
    <div className="wt-container py-10">
      <h1 className="text-4xl font-semibold">Seller Listing Assistant</h1>
      <p className="my-4">
        Bring your existing inventory into private, editable WineBloom drafts.
      </p>
      <Link className="wt-btn wt-btn-primary mb-8" href="/sell/import">
        Import existing products
      </Link>
      <MarketplaceAssistant initialMode="SELLER" sellerEnabled />
    </div>
  );
}
