# FEELACY Express

FEELACY Express orchestrates fulfillment between independent sellers, buyers, and approved third-party couriers. FEELACY never owns inventory or employs the courier.

## Safety defaults

- Global Express, alcohol delivery, sellers, locations, and providers require separate approval.
- Seller acceptance is manual. Dispatch requires paid order + seller acceptance + ready-for-pickup.
- Alcohol makes the complete order age-restricted, disables unattended delivery, and defaults failures to return-to-seller.
- Only a verification result, provider, and timestamp are retained; no ID image is stored.
- Ambiguous refund responsibility is marked for support review.

## Local pilot

Run `npm run db:migrate`, `npm run db:seed`, sign in as an administrator, and open `/admin/express`. Enable the global pilot, allow a country, approve a seller and pickup location, then enable seller availability at `/sell/express`. The mock provider is deterministic and makes no network calls.

The delivery webhook is `POST /api/webhooks/delivery/mock`, signed by an HMAC-SHA256 hex digest in `x-feelacy-signature`. In development only, `dev-mock` is accepted when no secret is configured.

DoorDash Drive and Uber Direct are intentionally not active: no approved credentials or contractual configuration existed in this repository. Add adapters behind server-only feature flags after provider review.
