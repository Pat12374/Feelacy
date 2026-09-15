# WineBloom security issues & remediations

Audit of Phase 1 found **21 priority issues** (consolidated from a 24-item review).  
Status reflects the secure fixes applied in this pass.

| # | Severity | Issue | Secure remediation | Status |
|---|---|---|---|---|
| 1 | Critical | Unpaid demo checkout could mark orders PAID | Gate with `ALLOW_DEMO_CHECKOUT=true` and never allow in production; refuse checkout if Connect incomplete | Fixed |
| 2 | Critical | Overselling / no inventory lock | Atomic `RESERVED` + quantity decrement; webhook only finalizes reserved listings; cancel releases stock | Fixed |
| 3 | High | Paid plans upgrade for free | Paid plans require Stripe Price IDs; local paid upgrade only via `ALLOW_LOCAL_PLAN_UPGRADE` in non-prod | Fixed |
| 4 | High | Age gate bypass on browse | Soft gate: catalog public; cookie required for account/sell/orders; DB age check on buy | Softened for UX |
| 5 | High | One-click age attestation | Stripe Identity document verification, verified DOB age calculation, signed webhook, and database checkout lock | Fixed |
| 6 | High | Stale JWT admin/age claims | JWT refresh ≤60s; `requireAdmin` / age checks hit the database | Fixed |
| 7 | High | Demo admin credentials on login UI | Credentials copy only in `development`; seed blocked in production | Fixed |
| 8 | High | No rate limiting | In-memory limiter on login/register/checkout; replace with Redis/Upstash in prod | Fixed (MVP) |
| 9 | High | Webhook paid without amount checks | Verify `payment_status`, amount, currency; ignore mismatches | Fixed |
| 10 | High | Quantity not enforced | Checkout requires `quantity > 0` inside reservation transaction | Fixed |
| 11 | Medium | `trustHost: true` | `trustHost` only when not production; set `AUTH_URL` | Fixed |
| 12 | Medium | Arbitrary listing image URLs | HTTPS allowlist (`images.unsplash.com`) | Fixed |
| 13 | Medium | Sellers self-publish ACTIVE | ACTIVE requires Connect onboarding (else `PENDING_REVIEW`) | Fixed |
| 14 | Medium | Missing security headers | CSP / frame deny / nosniff / referrer / permissions in `next.config` + middleware | Fixed |
| 15 | Medium | Weak passwords | Max length 128; min 8; add zxcvbn/HIBP later | Hardened |
| 16 | Medium | PENDING checkout leaves listing ACTIVE | Reservation status `RESERVED` until pay/cancel | Fixed |
| 17 | Medium | Stripe failure fell through to demo paid | No fall-through; demo only if explicitly allowed | Fixed |
| 18 | Medium | Subscription webhook trusts metadata alone | Cross-check subscription Price ID against expected/env/DB | Fixed |
| 19 | Medium | SQLite concurrency | Keep SQLite for local; **use Postgres in production** (ops requirement) | Documented |
| 20 | Medium | Settlement leaked on public listings | Seller/admin only | Fixed |
| 21 | Medium | Instant seller role / weak listing publish | ACTIVE gated on Connect; admin moderation path retained | Hardened |
| 22 | Critical | Connected-account events trusted order metadata | Bind payment events to stored Checkout session, connected account, currency, and charge | Fixed |
| 23 | High | Cancellation mutation exposed through an unsigned GET URL | Require an order-bound HMAC token plus buyer/admin authorization | Fixed |
| 24 | High | Password reset left existing JWT sessions valid | Increment a database session version and revalidate it on every authenticated request | Fixed |
| 25 | Medium | Identity, upload, and quote endpoints could be spammed | Add per-user/IP request limits and webhook body limits | Hardened |
| 26 | Medium | Seller tracking URL allowed non-HTTP schemes | Require HTTPS tracking links | Fixed |
| 27 | Medium | Production CSP allowed `unsafe-eval` | Restrict eval to development and disable object embedding | Fixed |
| 28 | Low | Health endpoint exposed security configuration state | Return only readiness state in production | Fixed |

## Related leftovers (not in the 21)

- Email enumeration softened (generic register redirects)
- Login errors mapped to fixed codes (no reflected free-text)
- Price bounds (€1–€100,000)
- Cancel URL releases reservations (`/api/checkout/cancel`)

## Production checklist

1. Set a strong `AUTH_SECRET` (`openssl rand -base64 32`)
2. `ALLOW_DEMO_CHECKOUT` and `ALLOW_LOCAL_PLAN_UPGRADE` **unset/false**
3. Postgres `DATABASE_URL`
4. Stripe secret + webhook secret + Merchant/Professional price IDs
5. Replace in-memory rate limits with Redis/Upstash
6. Counsel-reviewed age and alcohol-shipping compliance for each served market
7. Object-storage uploads instead of third-party image URLs when possible

## Seller catalog import security

- Every seller operation reuses database-backed `requireSeller`; jobs, templates,
  drafts, duplicate searches, approvals and connections bind to that seller.
- Mutations require same-origin requests and bounded streaming bodies. Uploads
  enforce MIME/extension/signature, UTF-8, row/column/cell limits; XLSX rejects
  formulas, VBA, external links, XML entities and oversized expanded ZIP contents.
- Production uploads fail closed without a configured HTTPS malware scanner.
  Its authenticated POST response must be exactly a successful JSON `status: clean`.
  No browser secret or local production bypass exists.
- URL fetches reject unsafe schemes, userinfo, odd ports and nonpublic IP ranges.
  All DNS answers must be public; the connection pins the vetted IP while keeping
  the original TLS hostname. Redirects are bounded and same-origin. Crawl targets
  and redirects honor robots policy. Time, response size, crawl scope and page
  counts are bounded. Infrastructure should additionally deny private egress.
- Authorized images are bounded, signature/type/dimension checked by Sharp,
  re-encoded to strip metadata and written to seller-specific WineBloom object keys.
  No imported image URL is installed directly as a listing image.
- Persistent database rate buckets cover uploads, mutations and verified webhook
  integration calls. Deploy edge body/time limits too; do not rely on Content-Length.
- Database job leases, conditional writes, seller serialization and unique job/row
  keys make processing and approval resumable. Imported events never publish.
- Connector credentials use AES-256-GCM with random nonces and connection-specific
  authenticated data. Both providers use timing-safe raw-body HMAC-SHA256 checks;
  body digests provide replay idempotency. Live endpoints return 503 until a
  certified adapter is installed. Unverified store IDs cannot bind a seller event.
- Inventory conflicts do not overwrite stock or disturb reservations. Sync failure
  states block checkout; active affected listings are paused where practical.
- The upload contents live only in seller-scoped staged records, not AuditLog.
  Audit metadata records authorization, counts, approvals and IDs. Do not log
  uploaded content, credentials, raw webhook bodies or customer information.
- Import review readiness is not legal clearance. Server publication and checkout
  reject imported alcohol until a jurisdiction-aware compliance service is wired
  in, including admin moderation. Non-alcohol clearance requires database-backed
  administrator authorization, an evidence reference, complete criteria, expiry
  and a digest bound to current product content. Content/image edits invalidate
  clearance; approval never publishes. Reservations fence concurrent edits and
  recheck eligibility and the price snapshot inside the reservation transaction.

Provider signature references: [Shopify verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)
and [WooCommerce webhook headers](https://developer.woocommerce.com/docs/apis/rest-api/v2/webhooks/).
