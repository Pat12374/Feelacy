import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wt-container py-16">
      <h1 className="font-sans text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-[var(--ink-soft)]">This page or listing may no longer be available.</p>
      <Link className="wt-btn wt-btn-primary mt-6" href="/search">Browse listings</Link>
    </main>
  );
}
