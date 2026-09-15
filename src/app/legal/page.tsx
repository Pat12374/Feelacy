import Link from "next/link";
import { legalDocuments } from "@/lib/legal-documents";

export const metadata = { title: "Legal" };

export default function LegalPage() {
  return (
    <main className="wt-container py-12 sm:py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">WineBloom</p>
        <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight sm:text-5xl">Legal documents</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--ink-soft)]">
          Find the terms, privacy information, marketplace policies, cookie information, and important notices that govern WineBloom.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {Object.entries(legalDocuments).map(([slug, document]) => (
            <Link
              key={slug}
              href={`/legal/${slug}`}
              className="rounded-2xl border border-[var(--line)] bg-white/60 p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-sm"
            >
              <h2 className="text-lg font-semibold">{document.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{document.summary}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[var(--accent)]">Read document →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
