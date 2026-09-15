"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Event = {
  id: string;
  status: string;
  error: string | null;
  source: Record<string, string>;
  listingUpdatedAt: string | null;
};
export function CatalogConnectionControls({
  id,
  status,
  mode: initialMode,
  fields: initialFields,
  events,
}: {
  id: string;
  status: string;
  mode: string;
  fields: string[];
  events: Event[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [fields, setFields] = useState(initialFields);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(input: object) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/catalog-connections/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      <label className="wt-label">
        Import mode
        <select
          disabled={status !== "ACTIVE" || busy}
          className="wt-input"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="ONE_TIME">One-time import</option>
          <option value="SCHEDULED">Scheduled synchronization</option>
          <option value="LIVE">Live verified webhooks</option>
        </select>
      </label>
      <fieldset
        className="flex flex-wrap gap-4"
        disabled={status !== "ACTIVE" || busy}
      >
        <legend className="mb-2">Allow the source to synchronize</legend>
        {["price", "quantity", "description", "images", "status"].map((f) => (
          <label key={f} className="flex gap-2">
            <input
              type="checkbox"
              checked={fields.includes(f)}
              onChange={(e) =>
                setFields((old) =>
                  e.target.checked ? [...old, f] : old.filter((x) => x !== f),
                )
              }
            />
            {f}
          </label>
        ))}
      </fieldset>
      <p className="text-sm">
        Price and inventory updates apply only with your permission. Conflicting
        edits pause the affected product. Nothing publishes automatically; no
        orders or customer data are shared.
      </p>
      <div className="flex gap-3">
        <button
          className="wt-btn wt-btn-secondary"
          disabled={status !== "ACTIVE" || busy}
          onClick={() => run({ action: "policy", mode, fields })}
        >
          Save synchronization choices
        </button>
        <button
          className="wt-btn wt-btn-secondary"
          disabled={status === "DISCONNECTED" || busy}
          onClick={() => run({ action: "disconnect" })}
        >
          Disconnect but keep listings
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <h3 className="text-xl font-semibold mt-4">Synchronization history</h3>
      {events.map((event) => (
        <div className="border-t border-[var(--line)] pt-3" key={event.id}>
          <p>
            {event.status} ·{" "}
            {event.source.title ||
              event.source.externalProductId ||
              "Product event"}
          </p>
          {event.error && <p className="text-sm">{event.error}</p>}
          {event.status === "CONFLICT" && event.listingUpdatedAt && (
            <form
              className="my-3 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const choices = Object.fromEntries([...form.entries()]);
                void run({
                  action: "resolve",
                  eventId: event.id,
                  listingUpdatedAt: event.listingUpdatedAt,
                  choices,
                });
              }}
            >
              <p className="text-sm">
                Review each field. Keeping FEELACY data disables source control
                of that field. Paused listings remain paused until you review
                their publication status.
              </p>
              {Object.entries(event.source)
                .filter(([f]) => initialFields.includes(f))
                .map(([f, value]) => (
                  <label key={f} className="wt-label">
                    {f}: source proposes {value.slice(0, 200)}
                    <select className="wt-input" name={f} required>
                      <option value="">Choose a resolution</option>
                      <option value="LOCAL">
                        Keep FEELACY; disable source control
                      </option>
                      <option value="SOURCE">Accept source value</option>
                    </select>
                  </label>
                ))}
              <button
                className="wt-btn wt-btn-primary justify-self-start"
                disabled={busy}
              >
                Resolve inventory and field conflicts
              </button>
            </form>
          )}
        </div>
      ))}
      {!events.length && <p>No synchronization events yet.</p>}
    </div>
  );
}
