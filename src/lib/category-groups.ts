export type CategoryGroup = { slug: string; title: string; description: string; items: readonly string[] };
export const CATEGORY_GROUPS: Record<string, { title: string; description: string; groups: readonly CategoryGroup[] }> = {
  spirits: { title: "Spirits", description: "Explore spirits by family and style from independent WineTreff sellers.", groups: [
    { slug: "whisky", title: "Whisky & Whiskey", description: "Scotch, bourbon, rye, and world whiskies.", items: ["Single Malt Scotch","Blended Scotch","Bourbon","Rye Whiskey","Irish Whiskey","Japanese Whisky","Canadian Whisky","World Whisky"] },
    { slug: "brandy", title: "Brandy & Cognac", description: "Grape and fruit brandies from classic regions.", items: ["Cognac","Armagnac","Calvados","Brandy de Jerez","Pisco","Grappa","Fruit Brandy"] },
    { slug: "other", title: "Other Spirits", description: "Rum, agave spirits, gin, vodka, and liqueurs.", items: ["Dark Rum","Aged Rum","Tequila","Mezcal","Gin","Vodka","Aquavit","Liqueurs","Amaro"] },
  ]},
  "rare-bottles": { title: "Rare Finds", description: "Explore limited, older, and unusual seller-described bottles.", groups: [
    { slug: "rare-wine", title: "Rare Wines", description: "Older vintages, limited releases, and cellar finds.", items: ["Vintage Bordeaux","Vintage Burgundy","Vintage Champagne","Cult Wines","Library Releases","Large Formats"] },
    { slug: "rare-spirits", title: "Rare Spirits", description: "Limited editions, discontinued releases, and old bottlings.", items: ["Old Scotch Bottlings","Limited Whiskey","Rare Cognac","Vintage Armagnac","Discontinued Spirits","Single Casks"] },
    { slug: "special", title: "Special Editions", description: "Distinctive formats and seller-described rarities.", items: ["Anniversary Editions","Artist Labels","Numbered Releases","Distillery Exclusives","Original Cases"] },
  ]},
  collectibles: { title: "Collectibles", description: "Explore collectible bottles, packaging, and wine-related pieces.", groups: [
    { slug: "bottles", title: "Collectible Bottles", description: "Seller-described bottles offered for collectors.", items: ["Commemorative Bottles","Limited Labels","Miniature Bottles","Vintage Bottles","Signed Bottles"] },
    { slug: "packaging", title: "Cases & Packaging", description: "Presentation and original packaging collectibles.", items: ["Original Wooden Cases","Presentation Boxes","Gift Tins","Vintage Packaging","Bottle Displays"] },
    { slug: "memorabilia", title: "Memorabilia", description: "Wine and spirits objects offered by sellers.", items: ["Advertising Pieces","Menus & Lists","Barware","Books & Guides","Distillery Memorabilia"] },
  ]},
  gifts: { title: "Gifts", description: "Explore seller-curated offers for celebrations and special occasions.", groups: [
    { slug: "occasion", title: "By Occasion", description: "Find offers suited to memorable moments.", items: ["Birthday Gifts","Wedding Gifts","Anniversary Gifts","Retirement Gifts","Housewarming Gifts","Corporate Gifts"] },
    { slug: "sets", title: "Gift Sets", description: "Seller-curated bottles and presentation sets.", items: ["Wine Gift Sets","Spirits Gift Sets","Tasting Sets","Food & Wine Sets","Presentation Boxes"] },
    { slug: "recipient", title: "By Recipient", description: "Discover gifts for different interests.", items: ["For Wine Lovers","For Whisky Lovers","For Collectors","For Hosts","For Beginners"] },
  ]},
  flowers: { title: "Flowers", description: "Explore bouquets, arrangements, and floral gifts from independent WineTreff sellers.", groups: [
    { slug: "bouquets", title: "Bouquets", description: "Fresh hand-tied flowers for gifting and celebrations.", items: ["Rose Bouquets","Seasonal Bouquets","Mixed Bouquets","Tulip Bouquets","Lily Bouquets","Wildflower Bouquets"] },
    { slug: "arrangements", title: "Arrangements", description: "Designed floral arrangements for the home and events.", items: ["Vase Arrangements","Table Centerpieces","Luxury Arrangements","Dried Flowers","Orchid Arrangements"] },
    { slug: "occasions", title: "By Occasion", description: "Flowers selected for meaningful occasions.", items: ["Birthday Flowers","Anniversary Flowers","Wedding Flowers","Congratulations Flowers","Thank You Flowers","Sympathy Flowers"] },
  ]},
};
