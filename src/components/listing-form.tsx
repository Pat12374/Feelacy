import { getTranslations } from "next-intl/server";
import { upsertListingAction } from "@/lib/actions/marketplace";
import { ListingImageInput } from "@/components/listing-image-input";

type Option = { id: string; name: string };

type ListingFormProps = {
  listing?: {
    id: string;
    title: string;
    description: string;
    priceCents: number;
    shippingCents: number;
    categoryId?: string | null;
    regionId?: string | null;
    producerId?: string | null;
    vintage?: number | null;
    abv?: number | null;
    bottleSizeMl?: number | null;
    condition?: string | null;
    fillLevel?: string | null;
    labelCondition?: string | null;
    tastingNotes?: string | null;
    status: string;
    containsAlcohol: boolean;
    ageVerificationRequired: boolean;
    signatureRequired: boolean;
    fragile: boolean;
    localDeliveryPermitted: boolean;
    declaredValueCents?: number | null;
    weightGrams?: number | null;
    specialHandling?: string | null;
    images?: { url: string }[];
  };
  categories: Option[];
  regions: Option[];
  producers: Option[];
};

export async function ListingForm({
  listing,
  categories,
  regions,
  producers,
}: ListingFormProps) {
  const t = await getTranslations("sell");

  return (
    <form action={upsertListingAction} className="grid max-w-2xl gap-4">
      {listing && <input type="hidden" name="listingId" value={listing.id} />}
      <label className="wt-label">
        {t("title")}
        <input
          className="wt-input"
          name="title"
          required
          minLength={3}
          defaultValue={listing?.title}
        />
      </label>
      <label className="wt-label">
        {t("description")}
        <textarea
          className="wt-textarea"
          name="description"
          required
          minLength={20}
          defaultValue={listing?.description}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="wt-label">
          {t("price")}
          <input
            className="wt-input"
            name="priceEuros"
            type="number"
            min={1}
            step="0.01"
            required
            defaultValue={
              listing ? (listing.priceCents / 100).toFixed(2) : undefined
            }
          />
        </label>
        <label className="wt-label">
          {t("shipping")}
          <input
            className="wt-input"
            name="shippingEuros"
            type="number"
            min={0}
            step="0.01"
            defaultValue={
              listing ? (listing.shippingCents / 100).toFixed(2) : "0"
            }
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="wt-label">
          {t("category")}
          <select
            className="wt-select"
            name="categoryId"
            defaultValue={listing?.categoryId ?? ""}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wt-label">
          {t("region")}
          <select
            className="wt-select"
            name="regionId"
            defaultValue={listing?.regionId ?? ""}
          >
            <option value="">—</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wt-label">
          {t("producer")}
          <select
            className="wt-select"
            name="producerId"
            defaultValue={listing?.producerId ?? ""}
          >
            <option value="">—</option>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="wt-label">
          {t("vintage")}
          <input
            className="wt-input"
            name="vintage"
            type="number"
            defaultValue={listing?.vintage ?? ""}
          />
        </label>
        <label className="wt-label">
          {t("abv")}
          <input
            className="wt-input"
            name="abv"
            type="number"
            step="0.1"
            defaultValue={listing?.abv ?? ""}
          />
        </label>
        <label className="wt-label">
          {t("size")}
          <input
            className="wt-input"
            name="bottleSizeMl"
            type="number"
            defaultValue={listing?.bottleSizeMl ?? "750"}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="wt-label">
          {t("condition")}
          <input
            className="wt-input"
            name="condition"
            defaultValue={listing?.condition ?? "Excellent"}
          />
        </label>
        <label className="wt-label">
          {t("fillLevel")}
          <input
            className="wt-input"
            name="fillLevel"
            defaultValue={listing?.fillLevel ?? ""}
          />
        </label>
        <label className="wt-label">
          {t("labelCondition")}
          <input
            className="wt-input"
            name="labelCondition"
            defaultValue={listing?.labelCondition ?? ""}
          />
        </label>
      </div>
      <label className="wt-label">
        {t("tastingNotes")}
        <textarea
          className="wt-textarea"
          name="tastingNotes"
          defaultValue={listing?.tastingNotes ?? ""}
        />
      </label>
      <ListingImageInput label={t("imageUrl")} defaultValue={listing?.images?.[0]?.url ?? ""} />
      <fieldset className="rounded-2xl border border-[var(--line)] p-4"><legend className="px-2 font-semibold">Fulfillment requirements</legend><div className="grid gap-3 sm:grid-cols-2">
        <Check name="containsAlcohol" label="Contains alcohol" checked={listing?.containsAlcohol ?? true}/><Check name="ageVerificationRequired" label="Age verification required" checked={listing?.ageVerificationRequired ?? true}/><Check name="signatureRequired" label="Signature required" checked={listing?.signatureRequired ?? true}/><Check name="fragile" label="Fragile" checked={listing?.fragile ?? true}/><Check name="localDeliveryPermitted" label="Permit local courier delivery" checked={listing?.localDeliveryPermitted ?? false}/>
        <label className="wt-label">Declared value (EUR)<input className="wt-input" name="declaredValueEuros" type="number" min="0" step=".01" defaultValue={listing?.declaredValueCents != null ? listing.declaredValueCents/100 : ""}/></label><label className="wt-label">Weight (grams)<input className="wt-input" name="weightGrams" type="number" min="0" defaultValue={listing?.weightGrams ?? ""}/></label><label className="wt-label sm:col-span-2">Special handling<textarea className="wt-textarea" name="specialHandling" defaultValue={listing?.specialHandling ?? ""}/></label>
      </div></fieldset>
      <label className="wt-label">
        {t("status")}
        <select
          className="wt-select"
          name="status"
          defaultValue={listing?.status ?? "DRAFT"}
        >
          <option value="DRAFT">{t("draft")}</option>
          <option value="PENDING_REVIEW">{t("pendingReview")}</option>
          <option value="ACTIVE">{t("active")}</option>
          <option value="UNLISTED">{t("unlisted")}</option>
        </select>
      </label>
      <button type="submit" className="wt-btn wt-btn-primary">
        {t("saveListing")}
      </button>
    </form>
  );
}

function Check({name,label,checked}:{name:string;label:string;checked:boolean}) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked}/>{label}</label>; }
