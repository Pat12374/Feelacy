export type CategoryGroup = { slug: string; title: string; description: string; items: readonly string[] };
export const CATEGORY_GROUPS: Record<string, { title: string; description: string; groups: readonly CategoryGroup[] }> = {
  spirits: { title: "Spirits", description: "Explore spirits by family and style from independent WineBloom sellers.", groups: [
    { slug: "whisky", title: "Whisky & Whiskey", description: "Scotch, bourbon, rye, and world whiskies.", items: ["Single Malt Scotch","Blended Scotch","Bourbon","Rye Whiskey","Irish Whiskey","Japanese Whisky","Canadian Whisky","World Whisky"] },
    { slug: "brandy", title: "Brandy & Cognac", description: "Grape and fruit brandies from classic regions.", items: ["Cognac","Armagnac","Calvados","Brandy de Jerez","Pisco","Grappa","Fruit Brandy"] },
    { slug: "other", title: "Other Spirits", description: "Rum, agave spirits, gin, vodka, and liqueurs.", items: ["Dark Rum","Aged Rum","Tequila","Mezcal","Gin","Vodka","Aquavit","Liqueurs","Amaro"] },
  ]},
  "rare-bottles": { title: "Rare Finds", description: "Explore limited, older, and unusual seller-described bottles.", groups: [
    { slug: "rare-wine", title: "Rare Wines", description: "Older vintages, limited releases, and cellar finds.", items: ["Vintage Bordeaux","Vintage Burgundy","Vintage Champagne","Cult Wines","Library Releases","Large Formats"] },
    { slug: "rare-spirits", title: "Rare Spirits", description: "Limited editions, discontinued releases, and old bottlings.", items: ["Old Scotch Bottlings","Limited Whiskey","Rare Cognac","Vintage Armagnac","Discontinued Spirits","Single Casks"] },
    { slug: "rare-perfumes", title: "Rare Perfumes", description: "Limited, vintage, and hard-to-find fragrances from independent sellers.", items: ["Vintage Perfumes","Limited Edition Perfumes","Niche Perfumes","Rare Attars","Discontinued Fragrances"] },
    { slug: "rare-coins", title: "Rare Coins", description: "Collectible and historically significant coins from independent sellers.", items: ["Ancient Coins","Gold Coins","Silver Coins","Commemorative Coins","Error Coins"] },
    { slug: "rare-gems", title: "Rare Gems", description: "Uncommon gemstones and collector gems offered by independent sellers.", items: ["Rare Diamonds","Natural Rubies","Fine Emeralds","Sapphires","Collector Gemstones"] },
  ]},
  collectibles: { title: "Collectibles", description: "Explore collectible bottles, packaging, and wine-related pieces.", groups: [
    { slug: "bottles", title: "Collectible Bottles", description: "Seller-described bottles offered for collectors.", items: ["Commemorative Bottles","Limited Labels","Miniature Bottles","Vintage Bottles","Signed Bottles"] },
    { slug: "packaging", title: "Cases & Packaging", description: "Presentation and original packaging collectibles.", items: ["Original Wooden Cases","Presentation Boxes","Gift Tins","Vintage Packaging","Bottle Displays"] },
    { slug: "memorabilia", title: "Memorabilia", description: "Wine and spirits objects offered by sellers.", items: ["Advertising Pieces","Menus & Lists","Barware","Books & Guides","Distillery Memorabilia"] },
    { slug: "coins", title: "Coins", description: "Collectible coins offered by independent sellers.", items: ["Ancient Coins","Gold Coins","Silver Coins","Commemorative Coins","Error Coins"] },
    { slug: "gems", title: "Gems", description: "Collectible gemstones offered by independent sellers.", items: ["Rare Diamonds","Natural Rubies","Fine Emeralds","Sapphires","Collector Gemstones"] },
    { slug: "ceramics", title: "Ceramics", description: "Collectible ceramic pieces, vessels, and decorative objects.", items: ["Handmade Ceramics","Vintage Ceramics","Porcelain Pieces","Ceramic Vessels","Decorative Ceramics"] },
    { slug: "specials", title: "Specials", description: "Distinctive collectible pieces and limited finds.", items: ["Limited Editions","Signed Pieces","Numbered Releases","Artist Collaborations","One-of-a-Kind Finds"] },
  ]},
  gifts: { title: "Gifts", description: "Explore seller-curated offers for celebrations and special occasions.", groups: [
    { slug: "gift-baskets", title: "Gift Baskets", description: "Curated wine, spirits, gourmet, and celebration baskets.", items: ["Red Wine Baskets","White Wine Baskets","Sparkling Wine Baskets","Mixed Wine Baskets","Wine & Cheese Baskets","Cheese & Charcuterie","Chocolate & Wine","Artisan Food Baskets","Dessert Baskets","Alcohol-Free Baskets","Birthday Baskets","Wedding Baskets","Anniversary Baskets","Thank You Baskets","Corporate Baskets","Holiday Baskets"] },
    { slug: "goldwares", title: "Goldwares", description: "Gold-toned and gold-finished presentation pieces for gifting.", items: ["Gold-Plated Glassware","Gold Serving Pieces","Gold Gift Accessories"] },
    { slug: "silverwares", title: "Silverwares", description: "Silver-toned and silver-finished presentation pieces for gifting.", items: ["Silver-Plated Glassware","Silver Serving Pieces","Silver Gift Accessories"] },
    { slug: "glassware", title: "Glassware", description: "Glassware for serving, tasting, and gifting.", items: ["Wine Glasses","Champagne Flutes","Whisky Glasses","Decanters","Tasting Glasses"] },
    { slug: "occasion", title: "By Occasion", description: "Find offers suited to memorable moments.", items: ["Birthday Gifts","Wedding Gifts","Anniversary Gifts","Retirement Gifts","Housewarming Gifts","Corporate Gifts"] },
    { slug: "sets", title: "Gift Sets", description: "Seller-curated bottles and presentation sets.", items: ["Wine Gift Sets","Spirits Gift Sets","Tasting Sets","Food & Wine Sets","Presentation Boxes"] },
    { slug: "recipient", title: "By Recipient", description: "Discover gifts for different interests.", items: ["For Wine Lovers","For Whisky Lovers","For Collectors","For Hosts","For Beginners"] },
  ]},
  flowers: { title: "Flowers", description: "Explore bouquets, arrangements, and floral gifts from independent WineBloom sellers.", groups: [
    { slug: "bouquets", title: "Bouquets", description: "Fresh hand-tied flowers for gifting and celebrations.", items: ["Rose Bouquets","Seasonal Bouquets","Mixed Bouquets","Tulip Bouquets","Lily Bouquets","Wildflower Bouquets"] },
    { slug: "arrangements", title: "Arrangements", description: "Designed floral arrangements for the home and events.", items: ["Vase Arrangements","Table Centerpieces","Luxury Arrangements","Dried Flowers","Orchid Arrangements"] },
    { slug: "occasions", title: "By Occasion", description: "Flowers selected for meaningful occasions.", items: ["Birthday Flowers","Anniversary Flowers","Wedding Flowers","Congratulations Flowers","Thank You Flowers","Sympathy Flowers"] },
  ]},
  perfumes: { title: "Perfumes", description: "Explore perfumes and fragrances from independent WineBloom sellers.", groups: [
    { slug: "families", title: "Fragrance Families", description: "Find scents by their defining fragrance profile.", items: ["Floral Fragrances","Woody Fragrances","Fresh Fragrances","Oriental Fragrances","Citrus Fragrances"] },
    { slug: "formats", title: "Perfume Formats", description: "Choose a fragrance format to suit your routine or collection.", items: ["Eau de Parfum","Eau de Toilette","Parfum Extracts","Colognes","Perfume Oils"] },
    { slug: "gifting", title: "Perfume Gifts", description: "Fragrance selections prepared for gifting and special occasions.", items: ["Perfume Gift Sets","Discovery Sets","Travel Sizes","Unisex Fragrances","Luxury Fragrances"] },
  ]},
};
