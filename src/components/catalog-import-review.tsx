"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  categories,
  fields,
  categoryFields,
  validateProduct,
  type Mapping,
  type Product,
} from "@/lib/catalog-import/product-ui";
type Row = {
  id: string;
  rowNumber: number;
  rawJson: string;
  productJson: string;
  version: number;
  title: string;
  status: string;
  missingFieldsCsv: string;
  validationErrorsJson: string;
  confidence: number;
  duplicateDraftId: string | null;
  duplicateListingId: string | null;
  duplicateResolution: string | null;
  approvedListingId: string | null;
  sellerAssertionsJson: string | null;
};
type Job = {
  status: string;
  sourceName: string;
  headersJson: string;
  mappingJson: string;
  totalRows: number;
  processedRows: number;
  error: string | null;
};
export function CatalogImportReview({
  id,
  templates,
}: {
  id: string;
  templates: { id: string; name: string; mappingJson: string }[];
}) {
  const [job, setJob] = useState<Job>();
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [template, setTemplate] = useState("");
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, Product>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkField, setBulkField] = useState("category");
  const [bulkValue, setBulkValue] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/catalog-imports/${id}?offset=${offset}`);
    if (!response.ok) throw new Error("Import unavailable");
    const data = await response.json();
    setJob(data.job);
    setRows(data.rows);
    setMapping((m) =>
      Object.keys(m).length ? m : JSON.parse(data.job.mappingJson),
    );
  }, [id, offset]);
  useEffect(() => {
    let active = true;
    const load = () =>
      refresh().catch((e) => {
        if (active) setError(e.message);
      });
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const run = async (payload: object) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/catalog-imports/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  // Local development can process batches from the review screen; cron continues without the browser.
  useEffect(() => {
    if (!job || !["QUEUED", "RUNNING"].includes(job.status)) return;
    const timer = setTimeout(() => {
      void fetch(`/api/catalog-imports/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      })
        .then(() => refresh())
        .catch(() => setError("Batch unavailable; retry or refresh"));
    }, 1000);
    return () => clearTimeout(timer);
  }, [job, id, refresh]);
  if (!job)
    return (
      <div className="wt-container py-10">
        <p role="status">Loading import…</p>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  const product = (r: Row): Product =>
    editing[r.id] || JSON.parse(r.productJson);
  const patch = (r: Row, field: string, value: string) =>
    setEditing((prev) => ({
      ...prev,
      [r.id]: { ...(prev[r.id] || JSON.parse(r.productJson)), [field]: value },
    }));
  const visible = rows.filter(
    (r) =>
      filter === "all" ||
      (filter === "approved" && r.status === "APPROVED_AND_CREATED") ||
      (filter === "ready" &&
        validateProduct(product(r)).ready &&
        !r.duplicateDraftId &&
        !r.duplicateListingId) ||
      (filter === "incomplete" && !!r.missingFieldsCsv) ||
      (filter === "duplicate" &&
        !!(r.duplicateDraftId || r.duplicateListingId)) ||
      (filter === "error" && r.validationErrorsJson !== "[]"),
  );
  async function save(
    targets: Row[],
    resolution?: string,
    separateConfirmed = false,
  ) {
    if (resolution === "SEPARATE" && !separateConfirmed) return;
    const ok = await run({
      action: "edit",
      edits: targets.map((r) => ({
        id: r.id,
        version: r.version,
        product: product(r),
        ...(resolution ? { resolution } : {}),
      })),
    });
    if (ok)
      setEditing((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([key]) => !targets.some((r) => r.id === key),
          ),
        ),
      );
  }
  return (
    <div className="wt-container py-10">
      <Link href="/sell/import" className="text-sm underline">
        All imports
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Review catalog import</h1>
      <p className="mt-2">
        {job.sourceName} · <strong>{job.status}</strong> · {job.processedRows}/
        {job.totalRows} rows processed
      </p>
      <progress
        className="my-4 w-full"
        max={job.totalRows}
        value={job.processedRows}
        aria-label="Import progress"
      />
      <p className="mb-4 text-sm">
        Nothing publishes automatically. Approval creates private FEELACY
        drafts. You remain responsible for accuracy, authorized content and
        seller fulfillment. Compliance review is separate from draft readiness.
      </p>
      {error && (
        <p className="mb-4 text-red-800" role="alert">
          {error}
        </p>
      )}
      {job.error && <p role="alert">{job.error}</p>}
      <div className="flex gap-3 mb-6">
        <a
          className="wt-btn wt-btn-secondary"
          href={`/api/catalog-imports/${id}?errors=1`}
        >
          Download error report
        </a>
        {["MAPPING", "QUEUED", "RUNNING", "FAILED"].includes(job.status) && (
          <button
            disabled={busy}
            className="wt-btn wt-btn-secondary"
            onClick={() => run({ action: "cancel" })}
          >
            Cancel import
          </button>
        )}
        {["FAILED", "CANCELLED"].includes(job.status) && (
          <button
            disabled={busy}
            className="wt-btn wt-btn-secondary"
            onClick={() => run({ action: "retry" })}
          >
            Retry unprocessed rows
          </button>
        )}
      </div>
      {job.status === "MAPPING" ? (
        <section className="rounded-xl border border-[var(--line)] p-5">
          <h2 className="text-2xl font-semibold">Map columns and preview</h2>
          <label className="wt-label my-4">
            Saved mapping
            <select
              className="wt-input"
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((t) => t.id === e.target.value);
                if (t) {
                  const saved = JSON.parse(t.mappingJson);
                  setMapping(
                    Object.fromEntries(
                      (JSON.parse(job.headersJson) as string[]).map((h) => [
                        h,
                        saved[h] || "",
                      ]),
                    ),
                  );
                }
              }}
            >
              <option value="">Automatic recognition</option>
              {templates.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Source column</th>
                  <th>FEELACY field</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {(JSON.parse(job.headersJson) as string[]).map((h) => (
                  <tr key={h}>
                    <td className="p-2">{h}</td>
                    <td className="p-2">
                      <select
                        aria-label={`Map ${h}`}
                        className="wt-input"
                        value={mapping[h] || ""}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [h]: e.target.value }))
                        }
                      >
                        <option value="">Do not import</option>
                        {fields.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 max-w-sm truncate">
                      {rows[0]
                        ? String(JSON.parse(rows[0].rawJson)[h] || "—").slice(
                            0,
                            140,
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="wt-label my-4">
            Save mapping as (optional)
            <input
              className="wt-input"
              value={template}
              maxLength={80}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="wt-btn wt-btn-primary"
            onClick={() =>
              run({
                action: "map",
                mapping,
                templateName: template || undefined,
              })
            }
          >
            Start import
          </button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 items-end my-5">
            <label className="wt-label">
              Filter this page
              <select
                className="wt-input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "all",
                  "ready",
                  "incomplete",
                  "duplicate",
                  "error",
                  "approved",
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="wt-label">
              Bulk field
              <select
                className="wt-input"
                value={bulkField}
                onChange={(e) => setBulkField(e.target.value)}
              >
                {fields.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="wt-label">
              Bulk value
              <input
                className="wt-input"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !selected.length}
              className="wt-btn wt-btn-secondary"
              onClick={() => {
                for (const r of rows.filter((r) => selected.includes(r.id)))
                  patch(r, bulkField, bulkValue);
              }}
            >
              Apply to selected
            </button>
            <button
              disabled={busy || !selected.length}
              className="wt-btn wt-btn-secondary"
              onClick={() => save(rows.filter((r) => selected.includes(r.id)))}
            >
              Save selected
            </button>
            <button
              disabled={busy || !selected.length}
              className="wt-btn wt-btn-secondary"
              onClick={() =>
                save(
                  rows.filter((r) => selected.includes(r.id)),
                  "SKIP",
                )
              }
            >
              Exclude selected
            </button>
            <button
              disabled={
                busy || !selected.length || selected.some((id) => editing[id])
              }
              className="wt-btn wt-btn-primary"
              onClick={() => run({ action: "approve", ids: selected })}
            >
              Approve selected drafts
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="bg-white/60">
                <tr>
                  <th className="p-3">
                    <input
                      type="checkbox"
                      aria-label="Select all editable rows"
                      checked={
                        !!selected.length &&
                        visible
                          .filter(
                            (r) =>
                              ![
                                "STAGED",
                                "APPROVED_AND_CREATED",
                                "EXCLUDED",
                              ].includes(r.status),
                          )
                          .every((r) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? visible
                                .filter(
                                  (r) =>
                                    ![
                                      "STAGED",
                                      "APPROVED_AND_CREATED",
                                      "EXCLUDED",
                                    ].includes(r.status),
                                )
                                .map((r) => r.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  {[
                    "Product and source",
                    "Category",
                    "Price (EUR)",
                    "Quantity",
                    "SKU",
                    "Review and compliance",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const p = product(r);
                  const readOnly = [
                    "STAGED",
                    "APPROVED_AND_CREATED",
                    "EXCLUDED",
                  ].includes(r.status);
                  const images =
                    JSON.parse(r.sellerAssertionsJson || "{}").images || [];
                  const v = validateProduct(p);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--line)] align-top"
                    >
                      <td className="p-3">
                        <input
                          aria-label={`Select row ${r.rowNumber}`}
                          type="checkbox"
                          disabled={readOnly}
                          checked={selected.includes(r.id)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked
                                ? [...s, r.id]
                                : s.filter((x) => x !== r.id),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 min-w-64">
                        {images[0] && (
                          <Image
                            unoptimized
                            src={images[0]}
                            alt="Imported product"
                            width={64}
                            height={64}
                            className="mb-2 h-16 w-16 object-contain"
                          />
                        )}
                        <input
                          aria-label={`Title row ${r.rowNumber}`}
                          className="wt-input"
                          disabled={readOnly}
                          value={p.title || ""}
                          onChange={(e) => patch(r, "title", e.target.value)}
                        />
                        {p.sourceUrl && /^https?:\/\//.test(p.sourceUrl) && (
                          <a
                            className="underline block my-2"
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Original source
                          </a>
                        )}
                        <details className="mt-3">
                          <summary>
                            Edit description and product details
                          </summary>
                          <label className="wt-label mt-2">
                            Description
                            <textarea
                              className="wt-input"
                              disabled={readOnly}
                              value={p.description || ""}
                              onChange={(e) =>
                                patch(r, "description", e.target.value)
                              }
                            />
                          </label>
                          {[
                            ...new Set([
                              "currency",
                              "gtin",
                              "imageUrls",
                              "sourceUrl",
                              "externalProductId",
                              "externalVariantId",
                              "variant",
                              "weightGrams",
                              "lengthCm",
                              "widthCm",
                              "heightCm",
                              ...(categoryFields[p.category] || []),
                            ]),
                          ].map((f) => (
                            <label className="wt-label mt-2" key={f}>
                              {f}
                              <input
                                className="wt-input"
                                disabled={readOnly}
                                value={p[f] || ""}
                                onChange={(e) => patch(r, f, e.target.value)}
                              />
                            </label>
                          ))}
                        </details>
                      </td>
                      <td className="p-3">
                        <select
                          aria-label={`Category row ${r.rowNumber}`}
                          disabled={readOnly}
                          className="wt-input"
                          value={p.category || ""}
                          onChange={(e) => patch(r, "category", e.target.value)}
                        >
                          <option value="">Review category</option>
                          {categories.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      {["price", "quantity", "sku"].map((f) => (
                        <td key={f} className="p-3">
                          <input
                            aria-label={`${f} row ${r.rowNumber}`}
                            className="wt-input min-w-24"
                            disabled={readOnly}
                            value={p[f] || ""}
                            onChange={(e) => patch(r, f, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="p-3 min-w-72">
                        <strong>{r.status.replaceAll("_", " ")}</strong>
                        <p>Confidence: {Math.round(r.confidence * 100)}%</p>
                        <p>Missing: {v.missing.join(", ") || "None"}</p>
                        <p className="text-red-800">
                          {[
                            ...new Set([
                              ...v.errors,
                              ...JSON.parse(r.validationErrorsJson),
                            ]),
                          ].join("; ")}
                        </p>
                        {(r.duplicateDraftId || r.duplicateListingId) && (
                          <p className="font-semibold mt-2">
                            Duplicate match ·{" "}
                            {r.duplicateResolution || "Resolution required"}
                          </p>
                        )}
                        <p className="mt-2">{v.compliance}</p>
                        <p>Publication readiness: compliance review required</p>
                      </td>
                      <td className="p-3 min-w-52">
                        {r.approvedListingId ? (
                          <Link
                            className="underline"
                            href={`/sell/listings/${r.approvedListingId}`}
                          >
                            Open full listing editor
                          </Link>
                        ) : r.status === "EXCLUDED" ? (
                          <button
                            disabled={busy}
                            className="wt-btn wt-btn-secondary"
                            onClick={() => save([r], "RESTORE")}
                          >
                            Restore excluded row
                          </button>
                        ) : (
                          !readOnly && (
                            <div className="grid gap-2">
                              <button
                                disabled={busy}
                                className="wt-btn wt-btn-secondary"
                                onClick={() => save([r])}
                              >
                                Save row
                              </button>
                              {(r.duplicateDraftId || r.duplicateListingId) && (
                                <>
                                  <button
                                    disabled={busy}
                                    className="wt-btn wt-btn-secondary"
                                    onClick={() => save([r], "UPDATE_DRAFT")}
                                  >
                                    Update existing draft
                                  </button>
                                  <button
                                    disabled={busy}
                                    className="wt-btn wt-btn-secondary"
                                    onClick={() => save([r], "MERGE")}
                                  >
                                    Merge edited information
                                  </button>
                                  <label className="text-sm">
                                    <input
                                      type="checkbox"
                                      id={`separate-${r.id}`}
                                    />{" "}
                                    I confirm this is a separate product
                                  </label>
                                  <button
                                    disabled={busy}
                                    className="wt-btn wt-btn-secondary"
                                    onClick={() => {
                                      const checked = (
                                        document.getElementById(
                                          `separate-${r.id}`,
                                        ) as HTMLInputElement
                                      ).checked;
                                      if (!checked)
                                        setError(
                                          "Confirm that this is a separate product first",
                                        );
                                      else void save([r], "SEPARATE", checked);
                                    }}
                                  >
                                    Create separate product
                                  </button>
                                  {r.duplicateListingId && (
                                    <Link
                                      className="underline"
                                      href={`/sell/listings/${r.duplicateListingId}`}
                                    >
                                      Review existing listing in editor
                                    </Link>
                                  )}
                                </>
                              )}
                              <button
                                disabled={busy || !v.ready || !!editing[r.id]}
                                className="wt-btn wt-btn-primary"
                                onClick={() =>
                                  run({ action: "approve", ids: [r.id] })
                                }
                              >
                                Approve private draft
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="my-5 flex gap-3">
            <button
              className="wt-btn wt-btn-secondary"
              disabled={!offset || Object.keys(editing).length > 0}
              onClick={() => {
                setOffset((n) => Math.max(0, n - 100));
                setSelected([]);
              }}
            >
              Previous 100
            </button>
            <span>
              Rows {offset + 1}–{Math.min(offset + 100, job.totalRows)} of{" "}
              {job.totalRows}
            </span>
            <button
              className="wt-btn wt-btn-secondary"
              disabled={
                offset + 100 >= job.totalRows || Object.keys(editing).length > 0
              }
              onClick={() => {
                setOffset((n) => n + 100);
                setSelected([]);
              }}
            >
              Next 100
            </button>
          </div>
        </>
      )}
    </div>
  );
}
