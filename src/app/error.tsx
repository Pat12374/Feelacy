"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wt-container py-16" role="alert">
      <h1 className="font-sans text-4xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-[var(--ink-soft)]">The request could not be completed. No payment should be retried until its order status is checked.</p>
      <button className="wt-btn wt-btn-primary mt-6" onClick={reset}>Try again</button>
    </main>
  );
}
