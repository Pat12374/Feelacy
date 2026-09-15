import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLegalDocumentSlug, legalDocuments } from "@/lib/legal-documents";

export function generateStaticParams() {
  return Object.keys(legalDocuments).map((document) => ({ document }));
}

type LegalPageProps = { params: Promise<{ document: string }> };

export async function generateMetadata({ params }: LegalPageProps) {
  const { document } = await params;
  if (!isLegalDocumentSlug(document)) return {};
  return { title: legalDocuments[document].title };
}

function isSectionHeading(line: string) {
  return /^\d+\.\s/.test(line) || (!/[.!?]$/.test(line) && line.split(/\s+/).length <= 8);
}

export default async function LegalDocumentPage({ params }: LegalPageProps) {
  const { document: slug } = await params;
  if (!isLegalDocumentSlug(slug)) notFound();

  const document = legalDocuments[slug];
  const source = await readFile(path.join(process.cwd(), "public", "legal-documents", document.textFile), "utf8");
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const content = lines.slice(2).filter((line) => !line.startsWith("Other WineBloom legal pages"));
  const statusLine = content.shift() ?? "";
  const introduction = content.shift() ?? document.summary;

  return (
    <main className="wt-container py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link href="/legal" className="text-sm font-semibold text-[var(--accent)] hover:underline">← All legal documents</Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">WineBloom</p>
        <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight sm:text-5xl">{document.title}</h1>
        <p className="mt-3 text-sm text-[var(--ink-soft)]">{statusLine}</p>

        {statusLine.includes("[INSERT DATE]") && (
          <aside className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
            Draft notice: this source document still contains effective-date and contact placeholders that must be completed before production launch.
          </aside>
        )}

        <p className="mt-8 text-lg leading-8 text-[var(--ink-soft)]">{introduction}</p>
        <div className="mt-10 space-y-6">
          {content.map((line, index) =>
            isSectionHeading(line) ? (
              <h2 key={`${index}-${line}`} className="pt-5 font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {line}
              </h2>
            ) : (
              <p key={`${index}-${line.slice(0, 24)}`} className="leading-7 text-[var(--ink-soft)]">{line}</p>
            ),
          )}
        </div>

        <div className="mt-12 border-t border-[var(--line)] pt-6">
          <a
            href={`/legal-documents/${document.downloadFile}`}
            download
            className="inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Download Word document
          </a>
        </div>
      </article>
    </main>
  );
}
