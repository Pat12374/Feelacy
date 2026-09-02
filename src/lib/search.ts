import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { marketplaceCategory } from "@/lib/marketplace-categories";

export type SearchParams = {
  q?: string;
  category?: string;
  region?: string;
  minPrice?: string;
  maxPrice?: string;
  vintage?: string;
  condition?: string;
  merchant?: string;
  sort?: string;
  page?: string;
  latitude?: string;
  longitude?: string;
  radiusMiles?: string;
  pickupOnly?: string;
  fulfillmentType?: string;
};

const PAGE_SIZE = 24;

export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchListings(params: SearchParams) {
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
  };

  if (params.q?.trim()) {
    const terms = params.q.trim().split(/\s+/).map(term => term.replace(/[^\p{L}\p{N}'’-]/gu, "")).filter(term => term.length > 1 && !["wine","wines","find","show","near","nearby","pickup","pick","up","me"].includes(term.toLowerCase())).slice(0, 6);
    if (terms.length) where.AND = terms.map(term => ({ OR: [{ title: { contains: term } }, { description: { contains: term } }, { searchText: { contains: term } }, { tastingNotes: { contains: term } }] }));
  }

  const selectedCategory = marketplaceCategory(params.category);
  if (params.category) {
    where.category = { slug: selectedCategory?.slug ?? "__invalid_category__" };
  }
  if (params.region) {
    where.region = { slug: params.region };
  }
  const sellerWhere: Prisma.SellerProfileWhereInput = {};
  if (params.merchant) sellerWhere.slug = params.merchant;
  if (params.fulfillmentType === "SELLER_PICKUP") sellerWhere.pickupLocations = { some: { approved: true, active: true } };
  if (params.fulfillmentType === "ON_DEMAND" || params.fulfillmentType === "EXPRESS") {
    where.localDeliveryPermitted = true;
    sellerWhere.deliverySettings = { is: { expressEnabled: true, acceptingLocalOrders: true, adminApprovalStatus: "APPROVED" } };
    sellerWhere.pickupLocations = { some: { approved: true, active: true } };
  }
  if (params.fulfillmentType === "SCHEDULED") {
    where.localDeliveryPermitted = true;
    sellerWhere.deliverySettings = { is: { scheduledEnabled: true, acceptingLocalOrders: true, adminApprovalStatus: "APPROVED" } };
    sellerWhere.pickupLocations = { some: { approved: true, active: true } };
  }
  if (Object.keys(sellerWhere).length) where.seller = sellerWhere;
  if (params.condition) {
    where.condition = params.condition;
  }
  if (params.vintage) {
    const v = Number(params.vintage);
    if (!Number.isNaN(v)) where.vintage = v;
  }

  const min = params.minPrice ? Math.round(Number(params.minPrice) * 100) : undefined;
  const max = params.maxPrice ? Math.round(Number(params.maxPrice) * 100) : undefined;
  if (min !== undefined && !Number.isNaN(min)) {
    where.priceCents = { ...(where.priceCents as object), gte: min };
  }
  if (max !== undefined && !Number.isNaN(max)) {
    where.priceCents = {
      ...((where.priceCents as object) ?? {}),
      lte: max,
    };
  }

  let orderBy: Prisma.ListingOrderByWithRelationInput[] = [
    { promoRank: "desc" },
    { createdAt: "desc" },
  ];
  switch (params.sort) {
    case "price_asc":
      orderBy = [{ priceCents: "asc" }];
      break;
    case "price_desc":
      orderBy = [{ priceCents: "desc" }];
      break;
    case "promo":
      orderBy = [{ promoRank: "desc" }];
      break;
  }

  const latitude = Number(params.latitude); const longitude = Number(params.longitude);
  const parsedRadius = Number(params.radiusMiles);
  const radius = Number.isFinite(parsedRadius)
    ? Math.min(100, Math.max(0, parsedRadius))
    : 5 * 0.621371;
  const proximityEligible = params.fulfillmentType === "SELLER_PICKUP" || params.fulfillmentType === "ON_DEMAND" || params.fulfillmentType === "EXPRESS";
  const proximity = proximityEligible && params.pickupOnly === "true" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const [candidates, categories, regions] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        seller: { select: { displayName: true, slug: true, region: true, pickupLocations: { where: { approved: true, active: true, latitude: { not: null }, longitude: { not: null } }, select: { latitude: true, longitude: true } } } },
        category: true,
        region: true,
        producer: true,
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
  ]);

  const matching = candidates.map(listing => {
    if (!proximity) return { ...listing, distanceMiles: undefined as number | undefined };
    const distances = listing.seller.pickupLocations.map(location => distanceMiles(latitude, longitude, location.latitude!, location.longitude!));
    const nearest = distances.length ? Math.min(...distances) : Infinity;
    return nearest <= radius ? { ...listing, distanceMiles: nearest as number | undefined } : null;
  }).filter((listing): listing is NonNullable<typeof listing> => listing !== null);
  const total = matching.length;
  const listings = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    listings,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    categories,
    regions,
  };
}
