# Launch checklist — WineTreff

Use this before a production deploy. Local build/lint must already pass.

## 1. Environment (production)

Copy `.env.example` → host secrets manager / Vercel env. Set:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | **Postgres** connection string (not `file:`) |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Yes | `https://your-domain` |
| `STRIPE_SECRET_KEY` | Yes | Live key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Endpoint `/api/webhooks/stripe` |
| `STRIPE_PRICE_MERCHANT` | Yes | Billing Price ID |
| `STRIPE_PRICE_PROFESSIONAL` | Yes | Billing Price ID |
| `STRIPE_AUTOMATIC_TAX` | Yes | `true`; configure tax registrations on each connected seller account |
| `CRON_SECRET` | Yes | Strong secret for expired-reservation cleanup |
| `MEDIA_*` | Yes | S3/R2-compatible bucket, public origin, and scoped upload credentials |
| `RESEND_API_KEY` | Yes | Welcome + password-reset email |
| `EMAIL_FROM` | Yes | Verified sender, e.g. `WineTreff <hello@domain.com>` |
| `ALLOW_DEMO_CHECKOUT` | Must be unset/false | Hard-blocked in prod |
| `ALLOW_LOCAL_PLAN_UPGRADE` | Must be unset/false | Hard-blocked in prod |
| `ALLOW_PROD_SEED` | Must be unset | Seed refuses in production |

Boot fails closed via `src/instrumentation.ts` if the above is wrong.

## 2. Database

```bash
npx prisma migrate deploy
# Do NOT run seed in production unless intentionally provisioning demo data
```

## 3. Stripe

1. Connect platform enabled (Express)
2. Webhook receives platform **and connected account** events listed in `docs/OPERATIONS.md`
3. Merchant + Professional recurring prices created and IDs stored

## 4. Verify

```bash
npm run build
npm run start
curl -s https://your-domain/api/health
# expect { "ok": true, "stripe": true, "authSecret": true, "demoCheckout": false }
```

Smoke paths: `/` → `/search` → listing → login → buy (test mode first) → seller Connect → plan upgrade.
Run the staging, monitoring, backup/restore, and rollback procedures in `docs/OPERATIONS.md`.

## 5. Legal / compliance (ops, not code)

- Counsel-reviewed terms, privacy, alcohol shipping rules
- Age attestation is not full KYC; sellers use Stripe identity
- Terms and seller onboarding clearly state that sellers—not WineTreff—are responsible for packing, shipping, tracking, delivery communication, and shipping-law compliance
- Replace Unsplash placeholders with owned media before marketing launch
