# WineTreff operations runbook

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
connected account receives the direct charge, WineTreff receives only the
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
- `charge.refunded`
- `account.updated`
- `customer.subscription.updated`, `customer.subscription.deleted`

