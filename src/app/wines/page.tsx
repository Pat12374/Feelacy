import Link from "next/link";

export const metadata = {
  title: "Wines",
  description: "Explore wines by color and style from independent WineTreff sellers.",
};

const groups = [
  { title: "White Wines", href: "/wines/white", description: "Explore crisp, aromatic, mineral, rich, and sweet white-wine styles.", className: "bg-[rgba(201,168,122,.16)]" },
  { title: "Red Wines", href: "/wines/red", description: "Explore elegant, structured, fruit-forward, and cellar-worthy red wines.", className: "bg-[rgba(111,35,47,.09)]" },
  { title: "Other Wines", href: "/wines/other", description: "Explore rosé, orange, sparkling, dessert, and fortified wine styles.", className: "bg-[rgba(198,111,120,.10)]" },
] as const;

export default function WinesPage() {
  return <div className="wt-container py-10">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--copper)]">Wine discovery</p>
    <h1 className="mt-3 font-display text-5xl tracking-tight sm:text-6xl">Explore wines</h1>
    <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">Choose a wine collection. Every variety links to currently available offers from independent WineTreff sellers.</p>
    <div className="mt-10 grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
      {groups.map(group => <Link key={group.href} href={group.href} className={`group flex min-h-44 flex-col justify-between rounded-2xl border border-[var(--line)] p-3 transition hover:-translate-y-1 hover:shadow-lg sm:min-h-60 sm:rounded-3xl sm:p-6 lg:min-h-72 lg:p-7 ${group.className}`}>
        <div><p className="hidden text-xs uppercase tracking-[.16em] text-[var(--copper)] sm:block">Collection</p><h2 className="font-display text-lg leading-tight sm:mt-3 sm:text-2xl lg:text-3xl">{group.title}</h2><p className="mt-2 hidden text-sm leading-6 text-[var(--ink-soft)] sm:block">{group.description}</p></div>
        <span className="mt-4 text-xs font-semibold text-[var(--bottle)] sm:text-sm lg:text-base">Explore <span aria-hidden="true">→</span></span>
      </Link>)}
    </div>
    <Link href="/search?category=wine" className="wt-btn wt-btn-primary mt-8">View all available wines</Link>
  </div>;
}
