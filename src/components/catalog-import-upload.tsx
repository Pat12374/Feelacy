"use client";
import { useState, useSyncExternalStore } from "react";
const subscribe = () => () => {};
import { useRouter } from "next/navigation";
export function CatalogImportUpload({
  maxBytes,
  maxRows,
}: {
  maxBytes: number;
  maxRows: number;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const [source, setSource] = useState("CSV");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white/60 p-6">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Import source"
      >
        {[
          ["CSV", "Upload CSV"],
          ["XLSX", "Upload Excel"],
          ["WEBSITE", "Import from website URL"],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            disabled={!hydrated || busy}
            aria-pressed={source === v}
            onClick={() => setSource(v)}
            className={`wt-btn ${source === v ? "wt-btn-primary" : "wt-btn-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        method="post"
        className="mt-6 grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/catalog-imports", {
              method: "POST",
              ...(source === "WEBSITE"
                ? {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      url: form.get("url"),
                      authorized: form.get("authorized") === "true",
                    }),
                  }
                : { body: form }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            router.push(`/sell/import/${data.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Import failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {source === "WEBSITE" ? (
          <label className="wt-label">
            Website, product, collection or sitemap URL
            <input
              className="wt-input"
              name="url"
              type="url"
              required
              placeholder="https://your-store.example/products"
            />
          </label>
        ) : (
          <label className="wt-label">
            {source === "CSV" ? "CSV file" : "Excel file"}
            <input
              key={source}
              className="wt-input"
              type="file"
              name="inventory"
              required
              accept={
                source === "CSV"
                  ? ".csv,text/csv"
                  : ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              }
            />
          </label>
        )}
        <p className="text-sm text-[var(--ink-soft)]">
          Up to {maxRows.toLocaleString()} rows and{" "}
          {Math.floor(maxBytes / 1024 / 1024)} MB. Excel: first worksheet,
          values only. Unknown product facts stay blank. Website imports use
          structured product data and respect site restrictions.
        </p>
        <label className="flex gap-3 text-sm">
          <input name="authorized" type="checkbox" value="true" required />I own
          or am authorized to use this catalog, website content and product
          images, and its terms permit this import. I remain responsible for
          accuracy and final publication.
        </label>
        <button
          disabled={busy || !hydrated}
          className="wt-btn wt-btn-primary justify-self-start"
        >
          {busy ? "Preparing preview…" : "Preview import"}
        </button>
        {error && (
          <p role="alert" className="text-red-800">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
