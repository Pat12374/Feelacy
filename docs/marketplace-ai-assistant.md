# Marketplace AI Assistant

WineBloom uses one permission-aware orchestrator with buyer, seller, and support modes. It never connects the model directly to the database. Live catalog search, draft creation, policy retrieval, and approvals remain server-side application operations.

## Local use

The assistant works without an API key using deterministic query interpretation and approved local policy excerpts. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` to enable Responses API explanations. Keys remain server-side and responses use `store: false`.

- `/assistant`: conversational live-catalog search and policy support.
- `/sell/assistant`: CSV-to-listing-draft workflow and seller mode.

The catalog workflow now lives at `/sell/import`, linked from `/sell/assistant`. CSV and XLSX files support configurable limits (default 10,000 rows / 10 MiB), persisted batches, mapping templates, website Product JSON-LD and sitemap extraction, inline/bulk review, duplicate resolution, cancellation and resumable retry. Approval is transactional and creates ordinary private `DRAFT` records. Imported alcohol publication remains blocked pending jurisdictional compliance integration; non-alcohol products require recorded administrator clearance before the seller can publish. See `seller-catalog-import.md`.

The assistant logs conversations, citations, live record identifiers returned by tools, escalation state, imports, and approvals. It does not log secrets or uploaded file contents in the general audit trail.

## Guardrails

- Only active listings with positive quantity are returned.
- Seller mode requires a seller or admin role and seller records are scoped by authenticated seller ID.
- Legal, dispute, authenticity, fraud, chargeback, and uncertain refund questions escalate to human support.
- AI text cannot create guarantees about price, availability, provenance, rarity, authenticity, or appreciation.
- No draft is directly published by the assistant.

Excel import is implemented with bounded parsing and a production-required malware scanner boundary. PDF, POS, support-ticket integrations and live managed inventory synchronization remain later phases. Shopify/WooCommerce production adapters require authorization and certification; the UI never simulates an active connection. Seller import instructions: [Bring My Catalog](seller-catalog-import.md).
