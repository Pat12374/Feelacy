import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export type AssistantMode = "BUYER" | "SELLER" | "SUPPORT";
type CatalogResult = { id: string; title: string; priceCents: number; currency: string; seller: string; url: string };
export type AssistantReply = { answer: string; mode: AssistantMode; results: CatalogResult[]; citations: { label: string; href: string }[]; escalated: boolean; conversationId: string };

const policies = [
  { keywords: ["fee", "commission", "cost"], label: "Seller fees", href: "/legal/fees", summary: "Buyer totals contain product price, seller shipping, and applicable tax. Marketplace commission is charged to sellers." },
  { keywords: ["privacy", "data", "id photo"], label: "Privacy policy", href: "/legal/privacy", summary: "WineBloom limits personal-data use and does not retain delivery ID photographs by default." },
  { keywords: ["rule", "terms", "refund", "dispute", "alcohol", "safety"], label: "Marketplace terms", href: "/legal/terms", summary: "WineBloom facilitates marketplace transactions; independent sellers remain sellers of record and disputes or uncertain refund outcomes require human review." },
];

function inferMode(message: string, requested?: AssistantMode): AssistantMode {
  if (requested) return requested;
  const q = message.toLowerCase();
  if (/listing|inventory|csv|price my|sell/.test(q)) return "SELLER";
  if (/refund|dispute|account|policy|fee|privacy|support/.test(q)) return "SUPPORT";
  return "BUYER";
}

export function parseAssistantSearchFilters(message: string) {
  const q = message.toLowerCase();
  const price = q.match(/(?:under|below|less than|max(?:imum)?)[\s$€£]*(\d+(?:\.\d{1,2})?)/);
  const vintage = q.match(/\b(19\d{2}|20\d{2})\b/);
  const categories: [RegExp, string][] = [[/scotch|whisk|spirit|bourbon|cognac/, "spirits"], [/rare|collectible/, "rare-bottles"], [/gift/, "gifts"], [/wine|riesling|bordeaux|burgundy|champagne/, "wine"]];
  const category = categories.find(([pattern]) => pattern.test(q))?.[1];
  const stop = new Set(["find","show","me","a","an","the","under","below","good","for","that","would","make","available","in","stock","please","wine","wines","spirit","spirits","gift","collectible"]);
  const terms = q.replace(/[^a-z0-9À-ž ]/g, " ").split(/\s+/).filter(x => x.length > 2 && !stop.has(x) && !/^\d+$/.test(x));
  return { category, maxCents: price ? Math.round(Number(price[1]) * 100) : undefined, vintage: vintage ? Number(vintage[1]) : undefined, terms: terms.slice(0, 5) };
}

async function searchCatalog(message: string): Promise<CatalogResult[]> {
  const f = parseAssistantSearchFilters(message);
  const listings = await prisma.listing.findMany({ where: { status: "ACTIVE", quantity: { gt: 0 }, ...(f.category ? { category: { slug: f.category } } : {}), ...(f.maxCents ? { priceCents: { lte: f.maxCents } } : {}), ...(f.vintage ? { vintage: f.vintage } : {}), ...(f.terms.length ? { OR: f.terms.flatMap(term => [{ title: { contains: term } }, { searchText: { contains: term } }, { description: { contains: term } }]) } : {}) }, include: { seller: true }, orderBy: [{ promoRank: "desc" }, { priceCents: "asc" }], take: 6 });
  return listings.map(x => ({ id: x.id, title: x.title, priceCents: x.priceCents, currency: x.currency, seller: x.seller.displayName, url: `/listings/${x.slug}` }));
}

async function optionalAIExplanation(message: string, mode: AssistantMode, results: CatalogResult[], fallback: string) {
  if (!process.env.OPENAI_API_KEY) return fallback;
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.4", store: false, max_output_tokens: 350, safety_identifier: createHash("sha256").update(message).digest("hex").slice(0, 32), instructions: "You are WineBloom's single marketplace assistant. Explain only the supplied live records and approved policy excerpts. Never invent products, availability, prices, seller claims, provenance, authenticity, rarity, legal rules, or investment potential. WineBloom facilitates sales and does not own inventory. Escalate disputes, legal questions, authenticity, suspicious activity, and uncertain refunds. Be concise.", input: JSON.stringify({ mode, user_request: message, live_available_offers: results, fallback }) }) });
  if (!response.ok) return fallback;
  const data = await response.json() as { output_text?: string }; return data.output_text?.trim() || fallback;
}

export async function runMarketplaceAssistant(input: { userId: string; message: string; mode?: AssistantMode; conversationId?: string }): Promise<AssistantReply> {
  const mode = inferMode(input.message, input.mode); const q = input.message.toLowerCase();
  const escalation = /lawyer|legal advice|chargeback|dispute|authentic|counterfeit|fraud|refund liability|suspicious/.test(q);
  const conversation = input.conversationId ? await prisma.aIConversation.findFirst({ where: { id: input.conversationId, userId: input.userId } }) : null;
  const active = conversation ?? await prisma.aIConversation.create({ data: { userId: input.userId, mode } });
  await prisma.aIMessage.create({ data: { conversationId: active.id, role: "USER", content: input.message } });
  let results: CatalogResult[] = []; let citations: {label:string;href:string}[] = []; let fallback: string;
  if (mode === "BUYER") { results = await searchCatalog(input.message); fallback = results.length ? `I found ${results.length} currently available offer${results.length === 1 ? "" : "s"} matching your request. These results come directly from WineBloom's live catalog; confirm seller details on each listing.` : "I couldn't find a currently available offer matching those details. Try broadening the category, price, vintage, or producer."; }
  else if (mode === "SUPPORT") { const matches = policies.filter(p => p.keywords.some(k => q.includes(k))); const selected = matches.length ? matches : [policies[2]]; citations = selected.map(({label,href}) => ({label,href})); fallback = escalation ? "This needs human review. I can point you to the relevant WineBloom policy, but I won’t guess about legal, authenticity, dispute, or refund outcomes. Please contact WineBloom support." : selected.map(p => p.summary).join(" "); }
  else { fallback = "Upload a CSV inventory file in the Seller Listing Assistant. I’ll prepare private, editable drafts, flag missing fields and possible duplicates, and wait for your approval before anything is published."; }
  const answer = await optionalAIExplanation(input.message, mode, results, fallback).catch(() => fallback);
  await prisma.$transaction([prisma.aIMessage.create({ data: { conversationId: active.id, role: "ASSISTANT", content: answer, citationsJson: JSON.stringify(citations), toolCallsJson: JSON.stringify(mode === "BUYER" ? [{ name: "search_catalog", resultIds: results.map(x => x.id) }] : mode === "SUPPORT" ? [{ name: "search_help_articles", citations }] : []) } }), prisma.aIConversation.update({ where: { id: active.id }, data: { mode, escalated: escalation } }), prisma.auditLog.create({ data: { actorId: input.userId, action: "AI_ASSISTANT_RESPONSE", meta: JSON.stringify({ conversationId: active.id, mode, resultCount: results.length, escalated: escalation }) } })]);
  return { answer, mode, results, citations, escalated: escalation, conversationId: active.id };
}
