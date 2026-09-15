# Bring My Catalog to FEELACY

Open **Seller dashboard → Import existing products** (`/sell/import`).
Nothing publishes automatically. You remain seller of record and responsible for
accurate product information, authorized content, pricing, stock, order acceptance,
packing, fulfillment, refunds and required records. FEELACY supplies marketplace
technology and never takes custody of inventory.

## Import a file

1. Export CSV (UTF-8) or Excel `.xlsx` from your current catalog. The first Excel
   worksheet is supported; export values instead of formulas. Do not include
   customers, orders, credentials or other personal data.
2. Select the file and confirm you own or are authorized to use its content and
   images and that its terms allow the import.
3. Review automatically recognized columns. Map unknown column names manually,
   omit unwanted fields, and optionally save a named seller-specific template.
4. Start the import. The default limits are 10,000 rows and 10 MiB. A background
   worker processes small batches; the review screen also advances queued jobs.
   Closing the browser does not discard staged work; an operational scheduler is
   required to continue work while the browser is closed.
5. Review rows. Empty quantity is **unknown**, not zero. Prices must be explicit
   and in EUR because the existing checkout only supports EUR. Fields specific to
   wine, spirits, flowers and wine accessories remain visible until completed.
6. Edit a row or select up to 100 rows on the current page, choose a bulk field,
   apply changes, then **Save selected**. Filters apply to the current 100-row page.
   Save edits before paging or approving. A concurrent change asks you to refresh.
7. Resolve duplicates, exclude unwanted rows, and download the CSV error report.
   Approve complete rows into ordinary private FEELACY drafts, then open the full
   listing editor. Approval of a selected group is atomic: fix or deselect invalid
   rows first. Valid rows can be approved independently of incomplete rows.

CSV examples: title, description, category, price, currency, quantity, SKU, UPC,
producer, product URL, image URLs, external product ID, external variant ID,
shipping weight and dimensions. Separate image URLs with `|` (up to eight images).
Use category values `wine`, `spirits`, `flowers`, or `wine-accessories`. Unknown
facts are never filled from assumptions; explicit `NV` is supported for vintage.

Category-specific text accepts seller-authored statements, including explicit
“not applicable” where accurate. Do not invent provenance, age, ABV, authenticity,
availability or legal eligibility to make a row appear complete.

## Website imports

Paste an authorized HTTP(S) product, collection, sitemap, or store URL. FEELACY
reads schema.org Product JSON-LD, including Product objects inside ItemList and
`@graph`, and product links/sitemaps on the same origin. It does not log into a
site, solve anti-bot challenges, or bypass robots rules or website terms.

Each request reads at most 20 pages, at most 1,000 extracted products and about
60 seconds of crawl work. Use a file export for larger stores. Unsupported feeds,
unstructured pages and uncertainty produce a review message or blank fields.
Quantities are never inferred from `InStock` markup. Images are copied into
FEELACY storage after validation. Failed copies must be removed from the image
URL field and supplied through the full listing editor; source images are never
permanently hotlinked. Direct external image hosts must also be authorized by you.

## Duplicates and retry

Matching order: source connection + external product/variant IDs, seller SKU,
seller UPC/GTIN, canonical product URL, stable product fingerprint. All matching
is seller-scoped. Earlier drafts are canonical so two rows cannot point at each
other. Existing ordinary listings without source identifiers cannot reliably be
matched; review carefully before approving a separate product.

- **Update existing draft:** replace a matched private draft with the reviewed data.
- **Merge edited information:** edit the incoming fields first, then apply the
  reviewed result to the matched private draft. This is an explicit replacement,
  not an automatic field-by-field merge.
- **Exclude selected:** skip rows without deleting the upload history.
- **Create separate product:** requires checking the separate-product confirmation.
- Existing active/reserved/sold listings cannot be overwritten by imports. Open
  their editor for a manual review; reservations cannot be edited.

Uploading the same parsed file again returns its existing job. Retry resumes only
unprocessed rows, and repeated approval returns the same listing. Cancel prevents
further row commits; a network request already in progress may finish but cannot
commit into a cancelled job. Retry a cancelled job to resume.

## Publication and integrations

Alcohol imports remain blocked server-side, including administrator moderation
and checkout, until verified seller licenses, approved origins/destinations,
shipping lanes, carriers, adult signatures and state shipment-volume enforcement
are integrated. Importing or approving a draft never grants legal eligibility.

Flowers and wine accessories require a recorded administrator review at
`/admin/catalog-imports`: product safety, tax configuration, shipping and returns,
prohibited products and claims, with an evidence reference and expiry. Clearance
is bound to the reviewed product content and does not publish the listing. The
seller then uses the existing editor/publication workflow, including existing
Connect requirements. Changing reviewed content or images requires fresh review.
The full listing editor now supports quantity and imported category-specific details.
Existing mixed-alcohol order controls remain in force; this import feature does
not add a multi-item basket.

Shopify and WooCommerce display **Unavailable / Coming soon**. The production-safe
adapter interface, encryption, signature validation, event persistence and conflict
logic exist for integration work, but there is no active OAuth/API connection.
Configuration alone does not turn an unverified adapter on. One-time file and
website imports are available; scheduled/live synchronization and managed API/feed
connections need a certified production adapter. No order or customer data is
shared with external stores.

Connected stores are designed to default to source-controlled price and inventory,
with explicit field consent and conflict review before overwriting seller edits.
`/sell/import/connections` provides mode/field controls, recent synchronization
history and explicit local/source conflict resolution for verified connections.
Keeping a local value withdraws source control for that field. Resolving a conflict
does not reactivate a paused listing; review it in the editor.
Disconnecting deletes local credentials and retains listings; revoke access at the
external platform too. See the operations runbook for engineering setup.

## Language fallback

The seller import workflow deliberately uses English for all supported locales
until reviewed translations are available. `messages/en.json:catalogImport` is
merged into every locale by `src/i18n/request.ts`; the screen displays an English
language notice. Technical field names and review messages also remain English.

Earlier unapproved `/sell/assistant` drafts appear under **Continue your earlier
assistant drafts**. Confirm content authorization to move those same records into
the new review queue; approved legacy listings are not recreated. Excluded rows
can be restored. If a disconnected store left uncertain inventory, verify the
actual available quantity and use the explicit inventory confirmation in the
listing editor before attempting publication.
