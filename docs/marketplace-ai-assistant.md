# Marketplace AI Assistant

WineTreff uses one permission-aware orchestrator with buyer, seller, and support modes. It never connects the model directly to the database. Live catalog search, draft creation, policy retrieval, and approvals remain server-side application operations.

## Local use

The assistant works without an API key using deterministic query interpretation and approved local policy excerpts. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` to enable Responses API explanations. Keys remain server-side and responses use `store: false`.

- `/assistant`: conversational live-catalog search and policy support.
- `/sell/assistant`: CSV-to-listing-draft workflow and seller mode.

CSV imports accept at most 100 rows and 2 MB. Drafts with missing fields or duplicate signals cannot be approved. Approval creates an ordinary private `DRAFT`; the seller must review it through the established listing editor before publication.

The assistant logs conversations, citations, live record identifiers returned by tools, escalation state, imports, and approvals. It does not log secrets or uploaded file contents in the general audit trail.

## Guardrails

- Only active listings with positive quantity are returned.
- Seller mode requires a seller or admin role and seller records are scoped by authenticated seller ID.
- Legal, dispute, authenticity, fraud, chargeback, and uncertain refund questions escalate to human support.
- AI text cannot create guarantees about price, availability, provenance, rarity, authenticity, or appreciation.
- No draft is directly published by the assistant.

Excel, PDF, POS, image extraction, support-ticket integrations, and managed inventory synchronization are later phases and require dedicated parsers, malware scanning, evidence retention rules, and approved external system credentials.
