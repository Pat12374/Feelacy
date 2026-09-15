# Catalog import verification

Verified on September 7, 2026 in the existing WineTreff workspace.

| Check | Result |
| --- | --- |
| `npx vitest run src/lib/catalog-import` | 78 tests passed across 4 files |
| `npm run typecheck` | Passed, including final launch check |
| `npm run lint` | Passed |
| `npm test` | 95 tests passed across 11 files |
| `npm run launch:check` | Passed type checking, lint, tests, and production build |
| Targeted catalog Playwright journeys | Passed in Chromium and mobile WebKit |
| Full `npm run test:e2e -- --workers=2` | 20 tests passed with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101` |
| Canonical PostgreSQL Prisma schema validation | Passed |
| Existing local SQLite records | All original columns and records preserved across 33 original tables |

Browser tests used a separate temporary, seeded SQLite database. The final full browser run preceded a backend-only deletion-event timestamp/audit adjustment; the final 95-test launch check and 78-test focused run include that adjustment and its regression coverage. Build and browser checks ran sequentially because production generation and local SQLite generation use different Prisma clients. The task-owned test server was stopped and the local Prisma client restored afterward.

The local database was backed up before applying additive schema changes. Backup: `/var/folders/vf/rn2vxc7x3_vdjs38wn9_kg300000gn/T/feelacy-before-catalog-MVk3NW/database.db`. Existing user source changes were preserved. No production deployment or production migration was performed.

## External verification still required

- Apply the three new forward migrations against a staging PostgreSQL database, then rehearse production deployment and rollback operations. PostgreSQL runtime migration execution was not available locally.
- Configure and exercise the production malware scanner and FEELACY-controlled object storage against real services. Production uploads fail closed without the required scanner response.
- Complete and certify production Shopify/WooCommerce OAuth/API adapters, register their polling/webhook entry points, and test real store authorization, token rotation, revocation, and delivery retries. The current verified adapter interfaces, encrypted credential handling, synchronization domain, signed webhook boundary, and deterministic fixtures are tested; live connection controls remain disabled. Credentials alone do not enable them.
- Validate website extraction and authorized image copying against an authorized real store. Structured extraction, robots handling, DNS pinning, redirect limits, and hostile fetch cases have transport-level integration tests; browser coverage exercises ownership confirmation and private-network rejection.
- Implement the jurisdiction-specific alcohol licensing, origin/destination, shipping/carrier, adult-signature, and volume policy services before imported wine or spirits can be published. Imported alcohol is blocked in the meantime. Non-alcohol publication requires recorded administrator evidence and the ordinary seller publication flow.

See [seller catalog import instructions](seller-catalog-import.md) and [operations](OPERATIONS.md) for routes, limits, configuration, retry, disconnect, and conflict procedures.
