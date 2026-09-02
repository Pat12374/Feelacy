# WineTreff security issues & remediations

Audit of Phase 1 found **21 priority issues** (consolidated from a 24-item review).  
Status reflects the secure fixes applied in this pass.

| # | Severity | Issue | Secure remediation | Status |
|---|---|---|---|---|
| 1 | Critical | Unpaid demo checkout could mark orders PAID | Gate with `ALLOW_DEMO_CHECKOUT=true` and never allow in production; refuse checkout if Connect incomplete | Fixed |
| 2 | Critical | Overselling / no inventory lock | Atomic `RESERVED` + quantity decrement; webhook only finalizes reserved listings; cancel releases stock | Fixed |
| 3 | High | Paid plans upgrade for free | Paid plans require Stripe Price IDs; local paid upgrade only via `ALLOW_LOCAL_PLAN_UPGRADE` in non-prod | Fixed |
| 4 | High | Age gate bypass on browse | Soft gate: catalog public; cookie required for account/sell/orders; DB age check on buy | Softened for UX |
| 5 | High | One-click age attestation | Cookie + account stamp; document that seller KYC is via Stripe Connect (stronger checks still recommended for compliance) | Hardened |
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
6. Counsel-reviewed age / alcohol shipping compliance beyond attestation
7. Object-storage uploads instead of third-party image URLs when possible
