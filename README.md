# WineTreff

Fixed-price marketplace for wines, spirits, rare bottles, and beverage collectibles.

WineTreff does not provide fulfillment. Sellers are responsible for packing, shipping, tracking, delivery communication, and compliance for their sales.

Buyers pay only the displayed product price, stated shipping, and applicable taxes/duties — never WineTreff commissions or marketplace premiums. Sellers use a hybrid subscription + commission model (Starter free/10%, Merchant €49/7%, Professional €149/5%, Enterprise from €399 / negotiated 3.5%–4.5%). Payment-processing costs are deducted from seller proceeds and disclosed separately (estimate 2.5% + €0.25; actual provider fee recorded).

See [docs/PLAN.md](docs/PLAN.md) and [docs/FEES.md](docs/FEES.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL-ready Prisma schema (SQLite for local)
- Auth.js (credentials)
- Stripe Connect + Billing (optional; demo checkout without keys)

## Quick start

```bash
cp .env.example .env
# Set a strong secret (required):
#   openssl rand -base64 32  → paste into AUTH_SECRET
# Local demo checkout (never in production):
#   ALLOW_DEMO_CHECKOUT=true
#   ALLOW_LOCAL_PLAN_UPGRADE=true
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Security remediations: [docs/SECURITY.md](docs/SECURITY.md).  
Production launch checklist: [docs/LAUNCH.md](docs/LAUNCH.md).
Operations, staging, monitoring, and backups: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Production

```bash
npm run launch:check
npx prisma migrate deploy
# Set production env per docs/LAUNCH.md — AUTH_SECRET, Postgres, Stripe, no demo flags
npm run start
curl -s https://your-domain/api/health
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

Password for all: `password123`

| Role   | Email                   |
|--------|-------------------------|
| Buyer  | buyer@winetreff.local   |
| Seller | seller@winetreff.local  |
| Admin  | admin@winetreff.local   |

Without Stripe keys, **Buy now** completes a demo paid order and finalizes settlement using the estimated processor fee as the actual fee.

### Email (welcome + forgot password)

Set `RESEND_API_KEY` and `EMAIL_FROM` to send real mail via [Resend](https://resend.com).  
Without those in development, messages are written to `tmp/email-outbox/` so you can verify content locally.

- Join → welcome / registration confirmation email  
- `/forgot-password` → reset link → `/reset-password`

## Scripts

| Script            | Purpose                |
|-------------------|------------------------|
| `npm run dev`     | Dev server             |
| `npm run build`   | Production build       |
| `npm run db:seed` | Seed plans + catalog   |
| `npm run db:studio` | Prisma Studio        |

## Stripe (production)

1. Set `STRIPE_SECRET_KEY`, webhook secret, and `NEXT_PUBLIC_APP_URL`.
2. Create Connect platform + Express onboarding from **Sell → Payouts**.
3. Map Billing Price IDs onto `SellerPlan.stripePriceId` for Merchant/Professional.
4. Forward webhooks to `/api/webhooks/stripe` (`checkout.session.completed`, `payment_intent.succeeded`, `account.updated`).

## Phase 2 (schema ready)

Saved searches, product comparison, regional hubs, promotional listings, and editorial CMS tables exist; UI ships after Phase 1 settlement is verified.
