"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/session";
import { approveRows } from "@/lib/catalog-import/service";
export async function importListingDraftsAction() {
  await requireSeller();
  redirect("/sell/import");
}
export async function approveListingDraftAction(formData: FormData) {
  const { seller } = await requireSeller();
  await approveRows(seller, [String(formData.get("draftId"))]);
  revalidatePath("/sell/listings");
  redirect("/sell/listings");
}

export async function continueLegacyDraftsAction(form: FormData) {
  const { seller } = await requireSeller();
  const { adoptLegacyDrafts } = await import("@/lib/catalog-import/service");
  const jobId = await adoptLegacyDrafts(
    seller,
    form.get("authorized") === "on",
  );
  redirect(jobId ? `/sell/import/${jobId}` : "/sell/import");
}
