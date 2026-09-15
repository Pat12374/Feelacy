import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PLAN_DEFAULTS } from "../src/lib/commerce/fees";
import type { PlanCode } from "../src/lib/types";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error(
      "Refusing to seed in production. Set ALLOW_PROD_SEED=true only for controlled break-glass use.",
    );
  }

  await prisma.expressConfiguration.upsert({ where: { id: "global" }, create: { id: "global", enabled: false, alcoholEnabled: false, allowedCountriesCsv: "" }, update: {} });
  await prisma.deliveryProviderConfig.upsert({ where: { code: "mock" }, create: { code: "mock", displayName: "Sandbox courier", enabled: true, environment: "sandbox" }, update: { displayName: "Sandbox courier", environment: "sandbox" } });

  const plans: { code: PlanCode; name: string; description: string }[] = [
    {
      code: "STARTER",
      name: "Starter",
      description: "Free plan with 10% commission on completed sales.",
    },
    {
      code: "MERCHANT",
      name: "Merchant",
      description: "€49/mo with 7% commission — for growing shops.",
    },
    {
      code: "PROFESSIONAL",
      name: "Professional",
      description: "€149/mo with 5% commission — high-volume merchants.",
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      description: "From €399/mo with negotiated 3.5%–4.5% commission.",
    },
  ];

  for (const p of plans) {
    const d = PLAN_DEFAULTS[p.code];
    await prisma.sellerPlan.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        monthlyPriceCents: d.monthlyPriceCents,
        defaultCommissionBps: d.commissionBps,
      },
      update: {
        name: p.name,
        description: p.description,
        monthlyPriceCents: d.monthlyPriceCents,
        defaultCommissionBps: d.commissionBps,
      },
    });
  }

  const categories = [
    { name: "Wine", slug: "wine" },
    { name: "Spirits", slug: "spirits" },
    { name: "Rare Bottles", slug: "rare-bottles" },
    { name: "Collectibles", slug: "collectibles" },
    { name: "Gift Baskets", slug: "gift-baskets" },
    { name: "Gifts", slug: "gifts" },
    { name: "Accessories", slug: "accessories" },
    { name: "Flowers", slug: "flowers" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name },
    });
  }

  const regions = [
    { name: "Bordeaux", slug: "bordeaux", country: "FR" },
    { name: "Burgundy", slug: "burgundy", country: "FR" },
    { name: "Mosel", slug: "mosel", country: "DE" },
    { name: "Rheingau", slug: "rheingau", country: "DE" },
    { name: "Speyside", slug: "speyside", country: "GB" },
    { name: "Islay", slug: "islay", country: "GB" },
    { name: "Tuscany", slug: "tuscany", country: "IT" },
    { name: "Rioja", slug: "rioja", country: "ES" },
  ];
  for (const r of regions) {
    await prisma.region.upsert({
      where: { slug: r.slug },
      create: r,
      update: { name: r.name, country: r.country },
    });
  }

  const producers = [
    { name: "Château Exemplar", slug: "chateau-exemplar" },
    { name: "Mosel Vale", slug: "mosel-vale" },
    { name: "Highland Cask Co.", slug: "highland-cask-co" },
    { name: "Maison Céleste", slug: "maison-celeste" },
  ];
  for (const p of producers) {
    await prisma.producer.upsert({
      where: { slug: p.slug },
      create: p,
      update: { name: p.name },
    });
  }

  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@feelacy.local" },
    create: {
      email: "admin@feelacy.local",
      name: "WineBloom Admin",
      passwordHash,
      role: "ADMIN",
      ageVerifiedAt: new Date(),
      ageVerificationStatus: "VERIFIED",
    },
    update: { role: "ADMIN", ageVerifiedAt: new Date(), ageVerificationStatus: "VERIFIED", passwordHash },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@feelacy.local" },
    create: {
      email: "seller@feelacy.local",
      name: "Cellar Merchant",
      passwordHash,
      role: "SELLER",
      ageVerifiedAt: new Date(),
      ageVerificationStatus: "VERIFIED",
    },
    update: { role: "SELLER", ageVerifiedAt: new Date(), ageVerificationStatus: "VERIFIED", passwordHash },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@feelacy.local" },
    create: {
      email: "buyer@feelacy.local",
      name: "Curious Buyer",
      passwordHash,
      role: "BUYER",
      ageVerifiedAt: new Date(),
      ageVerificationStatus: "VERIFIED",
    },
    update: { ageVerifiedAt: new Date(), ageVerificationStatus: "VERIFIED", passwordHash },
  });

  const starter = await prisma.sellerPlan.findUniqueOrThrow({
    where: { code: "STARTER" },
  });

  const seller = await prisma.sellerProfile.upsert({
    where: { slug: "rhein-cellars" },
    create: {
      userId: sellerUser.id,
      displayName: "Rhein Cellars",
      slug: "rhein-cellars",
      bio: "Private merchant specializing in German Riesling and select Bordeaux.",
      region: "Rheingau",
      country: "DE",
      planId: starter.id,
      commissionBps: PLAN_DEFAULTS.STARTER.commissionBps,
      subscription: { create: { status: "ACTIVE" } },
    },
    update: {
      userId: sellerUser.id,
      displayName: "Rhein Cellars",
      bio: "Private merchant specializing in German Riesling and select Bordeaux.",
      planId: starter.id,
      commissionBps: PLAN_DEFAULTS.STARTER.commissionBps,
    },
  });
  const seededPickup = await prisma.pickupLocation.findFirst({ where: { sellerId: seller.id, label: "Rhein Cellars pickup" } });
  if (seededPickup) await prisma.pickupLocation.update({ where: { id: seededPickup.id }, data: { approved: true, active: true, latitude: 52.520008, longitude: 13.404954 } });
  else await prisma.pickupLocation.create({ data: { sellerId: seller.id, label: "Rhein Cellars pickup", address1: "Demo pickup location", city: "Berlin", postalCode: "10115", country: "DE", approved: true, latitude: 52.520008, longitude: 13.404954 } });

  const wine = await prisma.category.findUniqueOrThrow({ where: { slug: "wine" } });
  const spirits = await prisma.category.findUniqueOrThrow({
    where: { slug: "spirits" },
  });
  const rare = await prisma.category.findUniqueOrThrow({
    where: { slug: "rare-bottles" },
  });
  const collectibles = await prisma.category.findUniqueOrThrow({ where: { slug: "collectibles" } });
  const gifts = await prisma.category.findUniqueOrThrow({ where: { slug: "gifts" } });
  const accessories = await prisma.category.findUniqueOrThrow({ where: { slug: "accessories" } });
  const flowers = await prisma.category.findUniqueOrThrow({ where: { slug: "flowers" } });
  const mosel = await prisma.region.findUniqueOrThrow({ where: { slug: "mosel" } });
  const bordeaux = await prisma.region.findUniqueOrThrow({
    where: { slug: "bordeaux" },
  });
  const speyside = await prisma.region.findUniqueOrThrow({
    where: { slug: "speyside" },
  });
  const moselVale = await prisma.producer.findUniqueOrThrow({
    where: { slug: "mosel-vale" },
  });
  const chateau = await prisma.producer.findUniqueOrThrow({
    where: { slug: "chateau-exemplar" },
  });
  const highland = await prisma.producer.findUniqueOrThrow({
    where: { slug: "highland-cask-co" },
  });

  const listings = [
    {
      title: "Mosel Vale Riesling Spätlese 2018",
      slug: "mosel-vale-riesling-spatlese-2018",
      description:
        "Cellar-kept Mosel Spätlese with bright slate minerality and stone-fruit depth. Fixed-price listing from a verified merchant.",
      priceCents: 4200,
      shippingCents: 890,
      categoryId: wine.id,
      regionId: mosel.id,
      producerId: moselVale.id,
      vintage: 2018,
      abv: 8.5,
      bottleSizeMl: 750,
      condition: "Excellent",
      fillLevel: "Into neck",
      labelCondition: "Clean",
      tastingNotes: "Peach, lime zest, wet slate, lingering sweetness.",
      imageUrl:
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80",
    },
    {
      title: "Château Exemplar Pauillac 2015",
      slug: "chateau-exemplar-pauillac-2015",
      description:
        "Left-bank Bordeaux from a strong vintage. Original wooden case not included. Ships within Germany and Austria.",
      priceCents: 18900,
      shippingCents: 1490,
      categoryId: rare.id,
      regionId: bordeaux.id,
      producerId: chateau.id,
      vintage: 2015,
      abv: 13.5,
      bottleSizeMl: 750,
      condition: "Very good",
      fillLevel: "Base of neck",
      labelCondition: "Slightly scuffed",
      tastingNotes: "Blackcurrant, cedar, graphite, fine tannins.",
      imageUrl:
        "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&q=80",
    },
    {
      title: "Highland Cask Speyside 18 Year",
      slug: "highland-cask-speyside-18",
      description:
        "Single malt matured in first-fill sherry casks. Collector bottle with intact tax strip.",
      priceCents: 24500,
      shippingCents: 1290,
      categoryId: spirits.id,
      regionId: speyside.id,
      producerId: highland.id,
      vintage: null,
      abv: 46,
      bottleSizeMl: 700,
      condition: "Excellent",
      fillLevel: "Full",
      labelCondition: "Pristine",
      tastingNotes: "Dried fig, oak spice, orange peel, cocoa.",
      imageUrl:
        "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=1200&q=80",
    },
    {
      title: "Maison Céleste Champagne Blanc de Blancs",
      slug: "maison-celeste-blanc-de-blancs",
      description:
        "Grower Champagne, disgorged 2022. Ideal for cellaring or immediate celebration.",
      priceCents: 7800,
      shippingCents: 990,
      categoryId: wine.id,
      regionId: null,
      producerId: (
        await prisma.producer.findUniqueOrThrow({
          where: { slug: "maison-celeste" },
        })
      ).id,
      vintage: 2016,
      abv: 12,
      bottleSizeMl: 750,
      condition: "Excellent",
      fillLevel: "Full",
      labelCondition: "Clean",
      tastingNotes: "Chalk, lemon curd, brioche, saline finish.",
      imageUrl:
        "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=1200&q=80",
    },
    {
      title: "Maison Céleste Pinot Noir 2020", slug: "maison-celeste-pinot-noir-2020", description: "Elegant red wine with bright cherry fruit, gentle spice, and a silky finish.", priceCents: 6900, shippingCents: 990, categoryId: wine.id, regionId: null, producerId: (await prisma.producer.findUniqueOrThrow({ where: { slug: "maison-celeste" } })).id, vintage: 2020, abv: 13, bottleSizeMl: 750, condition: "Excellent", fillLevel: "Full", labelCondition: "Clean", tastingNotes: "Red cherry, raspberry, subtle oak, silky tannins.", imageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&q=80",
    },
    {
      title: "Vintage Bordeaux Collector Presentation Box", slug: "vintage-bordeaux-collector-box", description: "Seller-described vintage wooden presentation box for wine collectors; bottle not included.", priceCents: 9500, shippingCents: 1290, categoryId: collectibles.id, regionId: bordeaux.id, producerId: null, vintage: null, abv: null, bottleSizeMl: null, condition: "Very good", fillLevel: null, labelCondition: null, tastingNotes: null, imageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&q=80",
    },
    {
      title: "Celebration Wine Gift Set", slug: "celebration-wine-gift-set", description: "Seller-curated celebration gift set with presentation packaging and wine accessories.", priceCents: 8900, shippingCents: 990, categoryId: gifts.id, regionId: null, producerId: null, vintage: null, abv: null, bottleSizeMl: null, condition: "New", fillLevel: null, labelCondition: null, tastingNotes: null, imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80",
    },
    {
      title: "Handcrafted Crystal Wine Decanter", slug: "crystal-wine-decanter", description: "Seller-listed crystal decanter for serving and aerating wine.", priceCents: 12000, shippingCents: 1190, categoryId: accessories.id, regionId: null, producerId: null, vintage: null, abv: null, bottleSizeMl: null, condition: "New", fillLevel: null, labelCondition: null, tastingNotes: null, imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80",
    },
    {
      title: "Seasonal Celebration Flower Bouquet", slug: "seasonal-celebration-flower-bouquet", description: "A seller-arranged seasonal bouquet for birthdays, congratulations, and wine-gift pairings.", priceCents: 5900, shippingCents: 790, categoryId: flowers.id, regionId: null, producerId: null, vintage: null, abv: null, bottleSizeMl: null, condition: "Fresh", fillLevel: null, labelCondition: null, tastingNotes: null, imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80",
    },
  ];

  for (const l of listings) {
    const { imageUrl, ...rest } = l;
    const searchText = [
      rest.title,
      rest.description,
      rest.tastingNotes,
      rest.condition,
      rest.vintage,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    await prisma.listing.upsert({
      where: { slug: rest.slug },
      create: {
        ...rest,
        sellerId: seller.id,
        status: "ACTIVE",
        saleType: "FIXED",
        searchText,
        images: {
          create: [{ url: imageUrl, alt: rest.title, sortOrder: 0 }],
        },
      },
      update: {
        title: rest.title,
        description: rest.description,
        priceCents: rest.priceCents,
        shippingCents: rest.shippingCents,
        categoryId: rest.categoryId,
        status: "ACTIVE",
        searchText,
      },
    });
  }

  await prisma.listing.updateMany({
    where: { categoryId: { in: [flowers.id, accessories.id] } },
    data: {
      containsAlcohol: false,
      ageVerificationRequired: false,
      signatureRequired: false,
      localDeliveryPermitted: true,
    },
  });

  console.log("Seed complete.");
  console.log("Accounts (password: password123):");
  console.log(`  admin  ${admin.email}`);
  console.log(`  seller ${sellerUser.email}`);
  console.log(`  buyer  ${buyer.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
