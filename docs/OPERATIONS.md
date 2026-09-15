# WineBloom operations runbook

## Staging gate

Staging must use PostgreSQL, Stripe test mode, a connected Express test account,
a verified email sender, owned object-storage media, and production-equivalent
environment flags. Run:

```bash
npm ci
npx prisma migrate deploy
npm run launch:check
npm run test:e2e
curl --fail https://staging.example.com/api/health
```

Complete one buyer, seller, and admin smoke path. For payments, verify the
connected account receives the direct charge, WineBloom receives only the
application fee, the actual BalanceTransaction fee is stored, duplicate
webhooks do not change balances, cancellation releases inventory, and full and
partial refunds update the order.

## Scheduled reservation cleanup

Call `POST /api/cron/release-reservations` every five minutes with
`Authorization: Bearer $CRON_SECRET`. Stripe's `checkout.session.expired` event
is the primary release signal; the scheduler recovers missed events.

## Monitoring

- Alert on `/api/health` returning non-200 for two consecutive probes.
- Alert on any `Stripe webhook processing failed`, amount mismatch, or pre-tax
  mismatch log.
- Monitor Stripe webhook delivery failures and Connect account restrictions.
- Track pending orders older than 35 minutes and settlements paid but not
  finalized after 10 minutes.
- Never log passwords, reset tokens, Stripe secrets, or full webhook bodies.

## PostgreSQL backups

- Enable managed-provider point-in-time recovery and daily encrypted snapshots.
- Retain daily backups for 30 days and monthly backups for 12 months, subject to
  the approved privacy retention policy.
- Quarterly, restore the newest backup into an isolated database, run
  migrations, compare row counts for orders/settlements/webhook events, and run
  the smoke suite. A backup is not accepted until a restore succeeds.

## Rollout and rollback

1. Back up the database and record the deployed migration/version.
2. Deploy migrations before application instances when they are backward
   compatible.
3. Roll out to a small percentage, verify health and a test payment, then expand.
4. Roll back application code on elevated error or payment mismatch rates. Do
   not reverse a data migration destructively; ship a forward repair migration.
5. Pause checkout if payment state is uncertain while leaving order lookup and
   seller records available.

## Stripe webhook configuration

The endpoint `/api/webhooks/stripe` must receive both platform and connected
account events. Subscribe to:

- `checkout.session.completed`, `checkout.session.expired`
- `payment_intent.succeeded`, `payment_intent.payment_failed`
- `identity.verification_session.verified`, `identity.verification_session.requires_input`, `identity.verification_session.processing`, `identity.verification_session.canceled`, `identity.verification_session.redacted`
- `charge.refunded`
- `account.updated`
- `customer.subscription.updated`, `customer.subscription.deleted`

## Catalog import operations

Deploy forward migration `20260907120000_catalog_import` before the application.
The subsequent `20260907130000_catalog_compliance` migration adds the reviewed
non-alcohol clearance record. It adds import metadata to `Listing`/`ListingDraft` and creates `CatalogImportJob`,
`CatalogMapping`, `CatalogConnection`, `CatalogSyncEvent`, and `CatalogRateLimit`.
No previous migration is rewritten. Local SQLite is derived by the existing helper;
production migration acceptance still requires a PostgreSQL staging deployment.

Configure `CATALOG_MAX_ROWS`, `CATALOG_MAX_FILE_BYTES`, `CATALOG_BATCH_SIZE` within
hard code caps (50,000 rows, 25 MiB, 100 rows/batch). Default batches are 25 rows;
a time budget yields early if images are slow. Configure `CATALOG_SCANNER_URL`
and `CATALOG_SCANNER_TOKEN`; the service receives raw bytes via HTTPS POST and must
return `{ "status": "clean" }` with a successful response. Production never skips
scanning. Reuse `MEDIA_*` S3/R2 settings for copied image storage. The website
fetcher needs outbound public HTTP(S)/DNS; deny private egress in infrastructure.

Schedule `POST /api/cron/catalog-imports` every minute with
`Authorization: Bearer $CRON_SECRET`. It processes up to two jobs, using leases to
prevent duplicate work. Expired leases recover abandoned workers. Poll persisted
job status; alert on FAILED and RUNNING jobs with expired leases. Seller Retry
resumes unprocessed rows; Cancel fences subsequent writes. Do not manually clear
row identifiers or approval links to retry. Source files are represented by staged
row data; no unbounded raw file blob is retained.

### Shopify / WooCommerce integration work

Live controls and webhook endpoints are deliberately unavailable even when
credentials are populated. Before enabling them:

1. Implement `CatalogAdapter` in `src/lib/catalog-import/connectors.ts` against
   approved read-only catalog APIs. Verify OAuth state and exact Shopify store
   identity, or WooCommerce API credentials and an SSRF-safe canonical store URL.
   Bind authorization and the verified immutable store ID to the authenticated
   seller. Request only catalog/inventory scopes; do not request orders/customers.
2. Configure `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, or the WooCommerce
   enablement gate plus seller API credentials. Generate `CATALOG_CREDENTIAL_KEY`
   as 32 random bytes encoded in base64. Store all secrets in a secret manager.
   `encryptCredentials` binds ciphertext to the connection ID. Never return it to
   the browser. A fixture adapter exists strictly for tests and cannot be selected
   by the seller UI.
3. Wire provider routes to `acceptVerifiedWebhook` using raw bounded bodies and
   provider signature headers (`X-Shopify-Hmac-Sha256` /
   `X-WC-Webhook-Signature`). Verify provider store identity before processing.
   Subscribe only to product create/update/delete, variation and inventory topics;
   normalize provider payloads to catalog fields. The current route intentionally
   returns 503 instead of pretending to accept events. Certify out-of-order events,
   replay, deletion, revocation, API versioning, pagination and stock semantics.
4. Persist explicit one-time/scheduled/live mode and sync field choices.
   `price` and `quantity` are the proposed connected-store defaults. Add the
   adapter registration and scheduler invocation before availability is enabled.
   `authorizeStore`, `importConnectedCatalog`, and `pollConnectedCatalog` provide
   verified identity, shared draft staging and bounded idempotent polling.
   The seller consent UI is at `/sell/import/connections`. Never activate products from a provider status change.
5. Use sync history and conflict records to compare the source, last accepted
   baseline and current WineBloom fields. Conflicting edits or uncertain inventory
   pause affected products. Reservations must finish or release before reconciliation;
   never overwrite reserved quantities. `/sell/import/connections` supports
   explicit conflict resolution, fenced by listing revision and reservation state.
   Source event timestamps reject stale updates. Production adapter scheduling
   and certification remain pending, so do not activate live sync yet.

To rotate encryption keys, pause connections/workers, decrypt each credential using
its existing key and connection ID, re-encrypt with the new key, verify a sample,
then atomically deploy the new key. Keep the old key only for a controlled rollback
window in the secret manager. Revocation removes the local encrypted credential,
sets DISCONNECTED and stops scheduling while retaining listings. Revoke the token
in Shopify/WooCommerce too; the production adapter must implement remote revocation.

No customer or order payload is sent externally. Any future order sharing requires
separate seller authorization and exact data-flow documentation.

### Retention and launch acceptance

Apply your approved retention policy to raw staged rows, source authorization and
sync histories. Do not purge approved listing links while retries may reference
them. Rate-limit rows can be removed after expiry. Audit records must preserve
seller authorization evidence for the legally approved period.

See `docs/seller-catalog-import.md` for duplicates, correction, retry and exclusion.
Before launch verify PostgreSQL migration deployment, malware scanner availability,
owned media writes, cron recovery, real authorized website extraction, provider
credentials and platform acceptance. Alcohol publication remains disabled until
jurisdiction-aware eligibility is implemented. Non-alcohol products require actual
review evidence entered by an administrator at `/admin/catalog-imports`; clearance
expires and is invalidated by reviewed content/image edits. Clearance does not
publish the listing. Existing Connect onboarding alone is insufficient.

The cron endpoint also consumes up to ten queued verified synchronization events.
FAILED events require operator investigation; never blindly reset inventory or
clear an uncertainty state. Retry after fixing the source; seller conflict resolution
records field choices and keeps listings paused until separate publication review.

`20260907140000_catalog_matching_indexes` adds seller-scoped match indexes for
large imports. Source product deletions pause inventory even when product-status
synchronization was not selected. Disconnecting preserves uncertain inventory
states; after reviewing actual availability, the seller can explicitly confirm
quantity in the listing editor for a disconnected store. This confirmation is
audited and cannot override an active reservation.

Browser verification uses a separate seeded SQLite database. When overriding
`PLAYWRIGHT_BASE_URL`, set the dev server's `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to
the same origin. Run builds and browser checks sequentially: the build generates
the PostgreSQL Prisma client, whereas local development generates SQLite's client.
