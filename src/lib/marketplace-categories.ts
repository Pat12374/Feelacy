export const MARKETPLACE_CATEGORIES = [
  { slug: "wine", label: "Wines", href: "/wines", description: "Wine listings, including white, red, rosé, sparkling, dessert, and fortified styles." },
  { slug: "spirits", label: "Spirits", href: "/categories/spirits", description: "Whisky, bourbon, cognac, rum, tequila, and other seller-listed spirits." },
  { slug: "rare-bottles", label: "Rare Finds", href: "/categories/rare-bottles", description: "Limited, older, collectible, or unusual bottles as described by their sellers." },
  { slug: "collectibles", label: "Collectibles", href: "/categories/collectibles", description: "Wine and spirits collectibles, presentation pieces, and seller-described memorabilia." },
  { slug: "gifts", label: "Gifts", href: "/categories/gifts", description: "Gift sets, presentation boxes, and occasion-ready offers from independent sellers." },
  { slug: "flowers", label: "Flowers", href: "/categories/flowers", description: "Bouquets, arrangements, and floral gifts offered by independent sellers." },
  { slug: "accessories", label: "Accessories", href: "/search?category=accessories", description: "Glassware, openers, decanters, storage tools, and related accessories." },
] as const;

export function marketplaceCategory(slug?: string) {
  return MARKETPLACE_CATEGORIES.find(category => category.slug === slug);
}
