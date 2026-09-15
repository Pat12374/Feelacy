"use server";

import { z } from "zod";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireSeller, requireAdmin, requireAgeVerified } from "@/lib/session";
import { slugify } from "@/lib/utils";
import {
  ENTERPRISE_COMMISSION_BPS_MAX,
  ENTERPRISE_COMMISSION_BPS_MIN,
  PLAN_DEFAULTS,
  buildSettlementPreview,
} from "@/lib/commerce/fees";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { allowDemoCheckout, isProduction } from "@/lib/security/env";
import {
  LISTING_PRICE_MAX_CENTS,
  LISTING_PRICE_MIN_CENTS,
  sanitizeListingImageUrl,
} from "@/lib/security/listing";
import { clientIpFromHeaders, rateLimit } from "@/lib/security/rate-limit";
import {
  fields as catalogFields,
  productSchema as catalogProductSchema,
  canonicalUrl,
} from "@/lib/catalog-import/product";
import {
  publicationEligibility,
  publicationDigest,
} from "@/lib/catalog-import/compliance";
import { signOrderCancellation } from "@/lib/security/tokens";

const listingSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(20).max(10_000),
  priceEuros: z.coerce
    .number()
    .positive()
    .max(LISTING_PRICE_MAX_CENTS / 100),
  quantity: z.coerce.number().int().min(0).max(1_000_000).default(1),
  shippingEuros: z.coerce.number().min(0).max(5_000).default(0),
  categoryId: z.string().optional(),
  regionId: z.string().optional(),
  producerId: z.string().optional(),
  vintage: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1000).max(2100).optional(),
  ),
  abv: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).max(100).optional(),
  ),
  bottleSizeMl: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(1000000).optional(),
  ),
  condition: z.string().max(80).optional(),
  fillLevel: z.string().max(80).optional(),
  labelCondition: z.string().max(80).optional(),
  tastingNotes: z.string().max(5_000).optional(),
  imageUrl: z.string().max(2_000).optional().or(z.literal("")),
  status: z
    .enum(["DRAFT", "ACTIVE", "UNLISTED", "PENDING_REVIEW"])
    .default("DRAFT"),
  containsAlcohol: z.boolean(),
  ageVerificationRequired: z.boolean(),
  signatureRequired: z.boolean(),
  fragile: z.boolean(),
  localDeliveryPermitted: z.boolean(),
  declaredValueEuros: z.coerce.number().min(0).optional(),
  weightGrams: z.coerce.number().int().min(0).optional(),
  specialHandling: z.string().max(1000).optional(),
});

function buildSearchText(parts: (string | number | null | undefined)[]) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Sellers may draft/unlist; ACTIVE requires Connect, admin, or local demo mode. */
function resolveListingStatus(
  requested: string,
  seller: { stripeOnboardingComplete: boolean },
  isAdminPublisher: boolean,
): string {
  if (requested === "DRAFT" || requested === "UNLISTED") return requested;
  if (requested === "ACTIVE") {
    if (
      isAdminPublisher ||
      seller.stripeOnboardingComplete ||
      allowDemoCheckout()
    ) {
      return "ACTIVE";
    }
    return "PENDING_REVIEW";
  }
  return "PENDING_REVIEW";
}

export async function upsertListingAction(formData: FormData): Promise<void> {
  const { seller, session } = await requireSeller();
  const listingId = String(formData.get("listingId") ?? "");
  const isAdminPublisher = session.user.role === "ADMIN";

  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priceEuros: formData.get("priceEuros"),
    quantity: formData.get("quantity") || 1,
    shippingEuros: formData.get("shippingEuros") || 0,
    categoryId: formData.get("categoryId") || undefined,
    regionId: formData.get("regionId") || undefined,
    producerId: formData.get("producerId") || undefined,
    vintage: formData.get("vintage") || "",
    abv: formData.get("abv") || "",
    bottleSizeMl: formData.get("bottleSizeMl") || "",
    condition: formData.get("condition") || undefined,
    fillLevel: formData.get("fillLevel") || undefined,
    labelCondition: formData.get("labelCondition") || undefined,
    tastingNotes: formData.get("tastingNotes") || undefined,
    imageUrl: formData.get("imageUrl") || "",
    status: formData.get("status") || "DRAFT",
    containsAlcohol: formData.get("containsAlcohol") === "on",
    ageVerificationRequired: formData.get("ageVerificationRequired") === "on",
    signatureRequired: formData.get("signatureRequired") === "on",
    fragile: formData.get("fragile") === "on",
    localDeliveryPermitted: formData.get("localDeliveryPermitted") === "on",
    declaredValueEuros: formData.get("declaredValueEuros") || undefined,
    weightGrams: formData.get("weightGrams") || undefined,
    specialHandling: formData.get("specialHandling") || undefined,
  });

  if (!parsed.success) {
    redirect(
      listingId
        ? `/sell/listings/${listingId}?error=invalid`
        : "/sell/listings/new?error=invalid",
    );
  }

  const data = parsed.data;
  const priceCents = Math.round(data.priceEuros * 100);
  if (
    priceCents < LISTING_PRICE_MIN_CENTS ||
    priceCents > LISTING_PRICE_MAX_CENTS
  ) {
    redirect("/sell/listings/new?error=price");
  }

  const shippingCents = Math.round(data.shippingEuros * 100);
  const vintage = typeof data.vintage === "number" ? data.vintage : null;
  const abv = typeof data.abv === "number" ? data.abv : null;
  const bottleSizeMl =
    typeof data.bottleSizeMl === "number" ? data.bottleSizeMl : null;
  const imageUrl = sanitizeListingImageUrl(data.imageUrl || null);
  const status = resolveListingStatus(data.status, seller, isAdminPublisher);

  const category = data.categoryId
    ? await prisma.category.findUnique({ where: { id: data.categoryId } })
    : null;
  const region = data.regionId
    ? await prisma.region.findUnique({ where: { id: data.regionId } })
    : null;

  const searchText = buildSearchText([
    data.title,
    data.description,
    data.tastingNotes,
    category?.name,
    region?.name,
    data.condition,
    vintage,
  ]);

  if (listingId) {
    const existing = await prisma.listing.findFirst({
      where: { id: listingId, sellerId: seller.id },
    });
    if (!existing) redirect("/sell/listings?error=notfound");
    if (existing.status === "RESERVED")
      redirect(`/sell/listings/${listingId}?error=reserved`);
    const existingImage = await prisma.listingImage.findFirst({
      where: { listingId },
      orderBy: { sortOrder: "asc" },
    });
    const imageChanged =
      data.imageUrl !== undefined && imageUrl !== (existingImage?.url || null);
    const catalogProduct = JSON.parse(existing.catalogProductJson) as Record<
      string,
      string
    >;
    if (existing.imported) {
      for (const f of catalogFields)
        if (formData.has(`catalog_${f}`))
          catalogProduct[f] = String(formData.get(`catalog_${f}`) || "");
      Object.assign(catalogProduct, {
        title: data.title,
        description: data.description,
        category: category?.slug || "",
        price: String(priceCents / 100),
        quantity: String(data.quantity),
        currency: existing.currency,
        vintage:
          data.vintage == null
            ? catalogProduct.vintage === "NV"
              ? "NV"
              : ""
            : String(data.vintage ?? ""),
        abv: String(data.abv ?? ""),
        bottleSizeMl: String(data.bottleSizeMl ?? ""),
        condition: data.condition || "",
      });
      if (!catalogProductSchema.safeParse(catalogProduct).success)
        redirect(`/sell/listings/${listingId}?error=invalid`);
    }
    const catalogProductJson = existing.imported
      ? JSON.stringify(catalogProduct)
      : existing.catalogProductJson;
    const containsAlcohol =
      data.containsAlcohol ||
      (existing.imported && ["wine", "spirits"].includes(category?.slug || ""));
    const proposed = {
      ...existing,
      catalogProductJson,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId || null,
      containsAlcohol,
      weightGrams: data.weightGrams ?? null,
      specialHandling: data.specialHandling ?? null,
      fragile: data.fragile,
      localDeliveryPermitted: data.localDeliveryPermitted,
    };
    const reconcileInventory = formData.get("inventoryReconciled") === "on";
    if (reconcileInventory) {
      const disconnected = existing.sourceConnectionId && await prisma.catalogConnection.findFirst({ where: { id: existing.sourceConnectionId, sellerId: seller.id, status: "DISCONNECTED" } });
      if (!disconnected) redirect(`/sell/listings/${listingId}?error=connected_inventory`);
      proposed.syncStatus = "DISCONNECTED";
    }
    const invalidatesReview =
      existing.imported &&
      (imageChanged ||
        publicationDigest(proposed) !== publicationDigest(existing));
    if (invalidatesReview) proposed.importComplianceStatus = "PENDING";
    if (data.status === "ACTIVE" && !publicationEligibility(proposed).allowed)
      redirect(`/sell/listings/${listingId}?error=import_compliance`);

    const saved = await prisma.listing.updateMany({
      where: {
        id: listingId,
        sellerId: seller.id,
        updatedAt: existing.updatedAt,
        status: { not: "RESERVED" },
      },
      data: {
        ...(reconcileInventory ? { syncStatus: "DISCONNECTED" } : {}),
        ...(existing.imported
          ? {
              catalogProductJson,
              sku: catalogProduct.sku || null,
              gtin: catalogProduct.gtin || null,
              sourceUrl: catalogProduct.sourceUrl
                ? canonicalUrl(catalogProduct.sourceUrl)
                : null,
            }
          : {}),
        ...(invalidatesReview
          ? {
              importComplianceStatus: "PENDING",
              importComplianceReviewJson: null,
            }
          : {}),
        title: data.title,
        description: data.description,
        priceCents,
        shippingCents,
        quantity: data.quantity,
        categoryId: data.categoryId || null,
        regionId: data.regionId || null,
        producerId: data.producerId || null,
        vintage,
        abv,
        bottleSizeMl,
        condition: data.condition,
        fillLevel: data.fillLevel,
        labelCondition: data.labelCondition,
        tastingNotes: data.tastingNotes,
        status,
        saleType: "FIXED",
        searchText,
        containsAlcohol,
        ageVerificationRequired:
          containsAlcohol || data.ageVerificationRequired,
        signatureRequired: containsAlcohol || data.signatureRequired,
        fragile: data.fragile,
        localDeliveryPermitted: data.localDeliveryPermitted,
        declaredValueCents:
          data.declaredValueEuros != null
            ? Math.round(data.declaredValueEuros * 100)
            : null,
        weightGrams: data.weightGrams ?? null,
        specialHandling: data.specialHandling,
      },
    });

    if (!saved.count) redirect(`/sell/listings/${listingId}?error=changed`);
    if (existing.imported && data.status === "ACTIVE")
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "CATALOG_PUBLICATION_REQUESTED",
          meta: JSON.stringify({ listingId, sellerId: seller.id, status }),
        },
      });
    if (imageChanged) {
      await prisma.listingImage.deleteMany({ where: { listingId } });
      if (imageUrl) {
        await prisma.listingImage.create({
          data: { listingId, url: imageUrl, sortOrder: 0 },
        });
      }
    }

    revalidatePath("/sell/listings");
    revalidatePath(`/listings/${existing.slug}`);
    redirect(`/sell/listings/${listingId}`);
  }

  let slug = slugify(data.title);
  const clash = await prisma.listing.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const listing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      title: data.title,
      slug,
      description: data.description,
      priceCents,
      shippingCents,
      quantity: data.quantity,
      categoryId: data.categoryId || null,
      regionId: data.regionId || null,
      producerId: data.producerId || null,
      vintage,
      abv,
      bottleSizeMl,
      condition: data.condition,
      fillLevel: data.fillLevel,
      labelCondition: data.labelCondition,
      tastingNotes: data.tastingNotes,
      status,
      saleType: "FIXED",
      searchText,
      containsAlcohol: data.containsAlcohol,
      ageVerificationRequired:
        data.containsAlcohol || data.ageVerificationRequired,
      signatureRequired: data.containsAlcohol || data.signatureRequired,
      fragile: data.fragile,
      localDeliveryPermitted: data.localDeliveryPermitted,
      declaredValueCents:
        data.declaredValueEuros != null
          ? Math.round(data.declaredValueEuros * 100)
          : null,
      weightGrams: data.weightGrams ?? null,
      specialHandling: data.specialHandling,
      images: imageUrl
        ? { create: [{ url: imageUrl, sortOrder: 0 }] }
        : undefined,
    },
  });

  revalidatePath("/sell/listings");
  revalidatePath("/search");
  redirect(`/sell/listings/${listing.id}`);
}

export async function changeSellerPlanAction(planCode: string): Promise<void> {
  const { seller } = await requireSeller();
  if (!["STARTER", "MERCHANT", "PROFESSIONAL"].includes(planCode)) {
    redirect("/sell/plan?error=enterprise");
  }

  const plan = await prisma.sellerPlan.findUnique({
    where: { code: planCode },
  });
  if (!plan) redirect("/sell/plan?error=missing");

  const defaults = PLAN_DEFAULTS[planCode as keyof typeof PLAN_DEFAULTS];

  // Free Starter can always be applied locally
  if (plan.monthlyPriceCents === 0) {
    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        planId: plan.id,
        commissionBps: defaults.commissionBps,
      },
    });
    await prisma.subscription.upsert({
      where: { sellerId: seller.id },
      create: { sellerId: seller.id, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
    revalidatePath("/sell/plan");
    redirect("/sell/plan?upgraded=1");
  }

  // Paid plans: require Stripe Billing price id; never apply for free
  const priceId =
    plan.stripePriceId ||
    (planCode === "MERCHANT"
      ? process.env.STRIPE_PRICE_MERCHANT
      : planCode === "PROFESSIONAL"
        ? process.env.STRIPE_PRICE_PROFESSIONAL
        : undefined);

  if (!isStripeConfigured() || !priceId) {
    if (isProduction() || process.env.ALLOW_LOCAL_PLAN_UPGRADE !== "true") {
      redirect("/sell/plan?error=billing");
    }
  }

  if (isStripeConfigured() && priceId) {
    const stripe = getStripe();
    let customerId = seller.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (await prisma.user.findUnique({ where: { id: seller.userId } }))
          ?.email,
        metadata: { sellerId: seller.id },
      });
      customerId = customer.id;
      await prisma.sellerProfile.update({
        where: { id: seller.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { sellerId: seller.id, planCode } },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/sell/plan?upgraded=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/sell/plan`,
      metadata: { sellerId: seller.id, planCode, expectedPriceId: priceId },
    });
    if (!session.url) redirect("/sell/plan?error=stripe");
    redirect(session.url);
  }

  // Explicit local-only paid upgrade (dev)
  if (process.env.ALLOW_LOCAL_PLAN_UPGRADE === "true" && !isProduction()) {
    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        planId: plan.id,
        commissionBps: defaults.commissionBps,
      },
    });
    await prisma.subscription.upsert({
      where: { sellerId: seller.id },
      create: { sellerId: seller.id, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
    revalidatePath("/sell/plan");
    redirect("/sell/plan?upgraded=1");
  }

  redirect("/sell/plan?error=billing");
}

export async function setEnterpriseCommissionAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const sellerId = String(formData.get("sellerId") ?? "");
  const bps = Number(formData.get("commissionBps"));
  if (
    !sellerId ||
    Number.isNaN(bps) ||
    bps < ENTERPRISE_COMMISSION_BPS_MIN ||
    bps > ENTERPRISE_COMMISSION_BPS_MAX
  ) {
    redirect("/admin?error=bps");
  }

  const enterprise = await prisma.sellerPlan.findUnique({
    where: { code: "ENTERPRISE" },
  });
  if (!enterprise) redirect("/admin?error=plan");

  await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: { planId: enterprise.id, commissionBps: Math.round(bps) },
  });

  const session = await auth();
  await prisma.auditLog.create({
    data: {
      actorId: session?.user?.id,
      action: "ENTERPRISE_COMMISSION_SET",
      meta: JSON.stringify({ sellerId, commissionBps: bps }),
    },
  });

  revalidatePath("/admin");
  redirect("/admin?ok=1");
}

export async function moderateListingAction(formData: FormData): Promise<void> {
  const adminSession = await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (
    !listingId ||
    !["ACTIVE", "UNLISTED", "PENDING_REVIEW"].includes(status)
  ) {
    redirect("/admin?error=moderation");
  }
  const reviewed = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (
    reviewed &&
    status === "ACTIVE" &&
    !publicationEligibility(reviewed).allowed
  )
    redirect("/admin?error=import_compliance");
  if (reviewed?.status === "RESERVED") redirect("/admin?error=reserved");
  if (!reviewed) redirect("/admin?error=notfound");
  const moderated = await prisma.listing.updateMany({
    where: {
      id: listingId,
      updatedAt: reviewed.updatedAt,
      status: { not: "RESERVED" },
    },
    data: { status },
  });
  if (!moderated.count) redirect("/admin?error=changed");
  await prisma.auditLog.create({
    data: {
      actorId: adminSession.user.id,
      action: "LISTING_MODERATED",
      meta: JSON.stringify({ listingId, sellerId: reviewed.sellerId, status }),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/search");
  redirect("/admin?ok=1");
}

export async function startCheckoutAction(
  listingId: string,
  deliveryQuoteId?: string,
): Promise<void> {
  const session = await requireAgeVerified();
  const ip = clientIpFromHeaders(await headers());
  const limited = rateLimit({
    key: `checkout:${session.user.id}:${ip}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) redirect("/search?error=rate");

  const previewListing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      status: "ACTIVE",
      quantity: { gt: 0 },
      syncStatus: { notIn: ["CONFLICT", "FAILED", "UNCERTAIN"] },
    },
    include: { seller: true },
  });
  if (!previewListing || !publicationEligibility(previewListing).allowed)
    redirect("/search?error=unavailable");
  if (previewListing.seller.userId === session.user.id) {
    redirect(`/listings/${previewListing.slug}?error=own`);
  }
  const deliveryQuote = deliveryQuoteId
    ? await prisma.deliveryQuote.findFirst({
        where: { id: deliveryQuoteId, sellerId: previewListing.sellerId },
        include: { pickupLocation: true },
      })
    : null;
  if (
    deliveryQuoteId &&
    (!deliveryQuote || deliveryQuote.expiresAt <= new Date())
  )
    redirect(`/checkout/${listingId}?error=quote_expired`);
  if (
    deliveryQuote &&
    (!previewListing.localDeliveryPermitted ||
      (previewListing.containsAlcohol &&
        (!deliveryQuote.ageVerification || deliveryQuote.contactlessAllowed)))
  )
    redirect(`/checkout/${listingId}?error=ineligible`);

  const preview = buildSettlementPreview({
    productSubtotalCents: previewListing.priceCents,
    shippingCents: deliveryQuote?.feeCents ?? previewListing.shippingCents,
    commissionBps: previewListing.seller.commissionBps,
  });

  // Atomic reserve: only one concurrent buyer wins
  const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const reserved = await prisma.$transaction(async (tx) => {
    const eligibilityListing = await tx.listing.findUnique({
      where: { id: listingId },
    });
    if (
      !eligibilityListing ||
      eligibilityListing.updatedAt.getTime() !==
        previewListing.updatedAt.getTime() ||
      !publicationEligibility(eligibilityListing).allowed
    )
      return null;
    // Conditional write is the concurrency lock: exactly one buyer can change
    // an ACTIVE in-stock listing to RESERVED.
    const claimed = await tx.listing.updateMany({
      where: {
        id: listingId,
        status: "ACTIVE",
        updatedAt: eligibilityListing.updatedAt,
        quantity: { gt: 0 },
        syncStatus: { notIn: ["CONFLICT", "FAILED", "UNCERTAIN"] },
      },
      data: { status: "RESERVED", quantity: { decrement: 1 } },
    });
    if (claimed.count !== 1) return null;

    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      include: { seller: true },
    });
    if (!listing) throw new Error("Reserved listing disappeared");

    const order = await tx.order.create({
      data: {
        buyerId: session.user.id,
        sellerId: listing.sellerId,
        status: "PENDING",
        currency: listing.currency,
        productSubtotalCents: preview.productSubtotalCents,
        shippingCents: preview.shippingCents,
        taxCents: preview.taxCents,
        buyerTotalCents: preview.buyerTotalCents,
        reservationExpiresAt,
        items: {
          create: [
            {
              listingId: listing.id,
              title: listing.title,
              quantity: 1,
              unitPriceCents: listing.priceCents,
              shippingCents: listing.shippingCents,
            },
          ],
        },
        settlement: {
          create: {
            productSubtotalCents: preview.productSubtotalCents,
            shippingCents: preview.shippingCents,
            taxCents: preview.taxCents,
            commissionBps: preview.commissionBps,
            commissionAmountCents: preview.commissionAmountCents,
            processorFeeEstimatedCents: preview.processorFeeEstimatedCents,
          },
        },
      },
    });

    if (deliveryQuote) {
      await tx.delivery.create({
        data: {
          orderId: order.id,
          sellerId: listing.sellerId,
          buyerId: session.user.id,
          pickupLocationId: deliveryQuote.pickupLocationId,
          providerConfigId: deliveryQuote.providerConfigId,
          quoteId: deliveryQuote.id,
          fulfillmentType: deliveryQuote.fulfillmentType,
          status: "awaiting_payment",
          deliveryAddressJson: deliveryQuote.deliveryAddressJson,
          ageRestricted: listing.containsAlcohol,
          signatureRequired: deliveryQuote.signatureRequired,
          contactlessAllowed: deliveryQuote.contactlessAllowed,
          pickupEta: deliveryQuote.pickupEta,
          deliveryEta: deliveryQuote.deliveryEta,
          buyerAcknowledgedAt: new Date(),
          history: {
            create: [
              {
                toStatus: "awaiting_payment",
                source: "buyer",
                detail: "Buyer selected and acknowledged delivery terms.",
              },
            ],
          },
        },
      });
      await tx.deliveryAcknowledgment.create({
        data: {
          orderId: order.id,
          buyerId: session.user.id,
          kind: "AGE_AND_FAILED_DELIVERY",
          version: "2026-09-02",
        },
      });
    }

    return { order, listing };
  });

  if (!reserved) redirect("/search?error=unavailable");
  const { order, listing } = reserved;

  const canStripe =
    isStripeConfigured() &&
    listing.seller.stripeAccountId &&
    listing.seller.stripeOnboardingComplete;

  if (canStripe) {
    try {
      const stripe = getStripe();
      const allowedCountries = listing.seller.shipToCountries
        .split(",")
        .map((country) => country.trim().toUpperCase())
        .filter(
          Boolean,
        ) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
      const checkout = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          automatic_tax: {
            enabled: process.env.STRIPE_AUTOMATIC_TAX === "true",
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: listing.currency,
                unit_amount: listing.priceCents,
                product_data: { name: listing.title },
              },
            },
            ...(listing.shippingCents > 0
              ? [
                  {
                    quantity: 1,
                    price_data: {
                      currency: listing.currency,
                      unit_amount: listing.shippingCents,
                      product_data: { name: "Shipping" },
                    },
                  },
                ]
              : []),
          ],
          payment_intent_data: {
            application_fee_amount: preview.commissionAmountCents,
            metadata: { orderId: order.id, listingId: listing.id },
          },
          shipping_address_collection: {
            allowed_countries:
              allowedCountries.length > 0 ? allowedCountries : ["DE"],
          },
          expires_at: Math.floor(reservationExpiresAt.getTime() / 1000),
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}?paid=1`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout/cancel?orderId=${order.id}&token=${signOrderCancellation(order.id)}`,
          metadata: {
            orderId: order.id,
            listingId: listing.id,
            expectedPreTaxAmount: String(
              preview.productSubtotalCents + preview.shippingCents,
            ),
            expectedCurrency: listing.currency,
          },
        },
        { stripeAccount: listing.seller.stripeAccountId! },
      );
      if (!checkout.url) throw new Error("Stripe Checkout URL missing");
      await prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutId: checkout.id },
      });
      redirect(checkout.url);
    } catch (e) {
      if (isRedirectError(e)) throw e;
      // Release reservation on Stripe failure
      await releaseReservation(order.id, listing.id);
      redirect(`/listings/${listing.slug}?error=stripe`);
    }
  }

  if (!allowDemoCheckout()) {
    await releaseReservation(order.id, listing.id);
    redirect(
      `/listings/${listing.slug}?error=${
        isStripeConfigured() ? "seller_payouts" : "payments"
      }`,
    );
  }

  // Demo path: explicit opt-in via ALLOW_DEMO_CHECKOUT=true (never production)
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", stripePaymentIntentId: `demo_${order.id}` },
    }),
    prisma.listing.update({
      where: { id: listing.id },
      data: { status: "SOLD", quantity: 0 },
    }),
    prisma.settlement.update({
      where: { orderId: order.id },
      data: {
        processorFeeActualCents: preview.processorFeeEstimatedCents,
        sellerPayoutCents:
          preview.buyerTotalCents -
          preview.commissionAmountCents -
          preview.processorFeeEstimatedCents,
        finalizedAt: new Date(),
      },
    }),
  ]);

  if (deliveryQuote)
    await prisma.$transaction([
      prisma.delivery.update({
        where: { orderId: order.id },
        data: { status: "awaiting_seller_acceptance" },
      }),
      prisma.deliveryStatusHistory.create({
        data: {
          deliveryId: (
            await prisma.delivery.findUniqueOrThrow({
              where: { orderId: order.id },
            })
          ).id,
          fromStatus: "awaiting_payment",
          toStatus: "awaiting_seller_acceptance",
          source: "payment",
        },
      }),
    ]);

  redirect(`/orders/${order.id}?paid=1&demo=1`);
}

async function releaseReservation(orderId: string, listingId: string) {
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    }),
    prisma.listing.updateMany({
      where: { id: listingId, status: "RESERVED" },
      data: { status: "ACTIVE", quantity: { increment: 1 } },
    }),
  ]);
}

export async function createConnectOnboardingLinkAction(): Promise<void> {
  const { seller } = await requireSeller();
  if (!isStripeConfigured()) {
    redirect("/sell/payouts?error=nostripe");
  }
  const stripe = getStripe();
  let accountId = seller.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: seller.country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { sellerId: seller.id },
    });
    accountId = account.id;
    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/sell/payouts`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/sell/payouts?connected=1`,
    type: "account_onboarding",
  });
  redirect(link.url);
}

const shippingUpdateSchema = z.object({
  orderId: z.string().min(1),
  carrier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(160).optional(),
  trackingUrl: z
    .string()
    .url()
    .max(2_000)
    .refine((value) => new URL(value).protocol === "https:", "HTTPS required")
    .optional()
    .or(z.literal("")),
  status: z.enum(["SHIPPED", "DELIVERED"]),
});

/** Records seller-managed shipping; WineBloom never acts as fulfiller or carrier. */
export async function updateShippingAction(formData: FormData): Promise<void> {
  const { seller } = await requireSeller();
  const parsed = shippingUpdateSchema.safeParse({
    orderId: formData.get("orderId"),
    carrier: formData.get("carrier") || undefined,
    trackingNumber: formData.get("trackingNumber") || undefined,
    trackingUrl: formData.get("trackingUrl") || "",
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/sell/orders?error=shipping");

  const order = await prisma.order.findFirst({
    where: {
      id: parsed.data.orderId,
      sellerId: seller.id,
      status: { in: ["PAID", "SHIPPED", "DELIVERED"] },
    },
  });
  if (!order) redirect("/sell/orders?error=order");

  const now = new Date();
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: parsed.data.status,
      carrier: parsed.data.carrier || null,
      trackingNumber: parsed.data.trackingNumber || null,
      trackingUrl: parsed.data.trackingUrl || null,
      shippedAt: order.shippedAt ?? now,
      deliveredAt: parsed.data.status === "DELIVERED" ? now : null,
    },
  });
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/sell/orders");
  redirect(`/orders/${order.id}?shipping=updated`);
}

export async function refundOrderAction(formData: FormData): Promise<void> {
  const { seller } = await requireSeller();
  const parsed = z
    .object({
      orderId: z.string().min(1),
      amountEuros: z.coerce.number().positive(),
    })
    .safeParse({
      orderId: formData.get("orderId"),
      amountEuros: formData.get("amountEuros"),
    });
  if (!parsed.success) redirect("/sell/orders?error=refund");

  const order = await prisma.order.findFirst({
    where: {
      id: parsed.data.orderId,
      sellerId: seller.id,
      status: { in: ["PAID", "SHIPPED", "DELIVERED", "PARTIALLY_REFUNDED"] },
    },
  });
  const amountCents = Math.round(parsed.data.amountEuros * 100);
  if (
    !order?.stripeChargeId ||
    !seller.stripeAccountId ||
    amountCents > order.buyerTotalCents - order.refundedCents
  ) {
    redirect(`/orders/${parsed.data.orderId}?error=refund`);
  }
  const stripe = getStripe();
  await stripe.refunds.create(
    {
      charge: order.stripeChargeId,
      amount: amountCents,
      refund_application_fee: true,
      metadata: { orderId: order.id },
    },
    { stripeAccount: seller.stripeAccountId },
  );
  redirect(`/orders/${order.id}?refund=pending`);
}
