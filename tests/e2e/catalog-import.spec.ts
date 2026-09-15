import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
const origin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
let sellerCookies: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
async function login(page: Page) {
  if (sellerCookies) {
    await page.context().addCookies(sellerCookies);
    await page.goto("/sell/import");
    await expect(
      page.getByRole("heading", { name: "Bring My Catalog to WineBloom" }),
    ).toBeVisible();
    return;
  }
  await page.context().addCookies([
    { name: "wt_age_verified", value: "1", url: origin },
    { name: "NEXT_LOCALE", value: "en", url: origin },
  ]);
  await page.goto("/login?next=/sell/import");
  await page.locator('input[name="email"]').fill("seller@feelacy.local");
  await page.locator('input[name="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sell\/import$/);
  await expect(
    page.getByRole("heading", { name: "Bring My Catalog to WineBloom" }),
  ).toBeVisible();
  sellerCookies = await page.context().cookies();
}
const item = (name: string) => ({
  title: name,
  description: "Oak display box for used wine corks.",
  category: "wine-accessories",
  price: "25.50",
  currency: "EUR",
  quantity: "4",
  accessoryType: "Box",
  brand: "Maker",
  materials: "Oak",
  dimensions: "20cm",
  compatibility: "Corks",
  safetyInformation: "Keep dry",
  warranty: "Two years",
  returnsRules: "Contact seller for returns",
});
async function upload(page: Page, data: Record<string, string>, type = "csv") {
  if (new URL(page.url()).pathname !== "/sell/import")
    await page.goto("/sell/import");
  const entries = Object.entries(data);
  let buffer: Buffer;
  if (type === "xlsx") {
    await page.getByRole("button", { name: "Upload Excel" }).click();
    const row = (values: string[], n: number) =>
      `<row>${values.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${n}" t="inlineStr"><is><t>${v}</t></is></c>`).join("")}</row>`;
    buffer = Buffer.from(
      zipSync({
        "[Content_Types].xml": strToU8("<Types/>"),
        "xl/workbook.xml": strToU8("<workbook/>"),
        "xl/worksheets/sheet1.xml": strToU8(
          `<worksheet><sheetData>${row(
            entries.map((e) => e[0]),
            1,
          )}${row(
            entries.map((e) => e[1]),
            2,
          )}</sheetData></worksheet>`,
        ),
      }),
    );
  } else
    buffer = Buffer.from(
      entries.map((e) => e[0]).join(",") +
        "\n" +
        entries.map((e) => `"${e[1].replaceAll('"', '""')}"`).join(","),
    );
  await page.locator('input[name="inventory"]').setInputFiles({
    name: `catalog.${type}`,
    mimeType:
      type === "csv"
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await page.locator('input[name="authorized"]').check();
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(
    page.getByRole("heading", { name: "Map columns and preview" }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page.getByRole("button", { name: "Start import" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1", {
    timeout: 30000,
  });
}
test.describe("seller catalog imports", () => {
  test("unauthorized seller cannot access import jobs", async ({
    page,
    request,
  }) => {
    await page.goto("/sell/import");
    await expect(page).toHaveURL(/age-gate|login/);
    const r = await request.get("/api/catalog-imports/not-owned", {
      maxRedirects: 0,
    });
    expect([302, 303, 307, 401, 403]).toContain(r.status());
  });
  test("CSV import, bulk edit and non-alcohol private draft approval", async ({
    page,
  }) => {
    await login(page);
    await upload(page, item(`E2E CSV ${Date.now()}`));
    await start(page);
    await page
      .getByRole("checkbox", { name: "Select row 2", exact: true })
      .check();
    await page.getByLabel("Bulk field").selectOption("price");
    await page.getByLabel("Bulk value").fill("29.00");
    await page.getByRole("button", { name: "Apply to selected" }).click();
    await page.getByRole("button", { name: "Save selected" }).click();
    await expect(page.getByLabel("price row 2")).toHaveValue("29.00");
    await page.getByRole("button", { name: "Approve selected drafts" }).click();
    await page.getByRole("link", { name: "Open full listing editor" }).click();
    await expect(page.getByRole("status")).toContainText("private draft");
  });
  test("Excel upload supports manual column mapping", async ({ page }) => {
    await login(page);
    const data = item(`E2E Excel ${Date.now()}`);
    const { title, ...rest } = data;
    await upload(page, { CatalogName: title, ...rest }, "xlsx");
    await page
      .getByLabel("Map CatalogName", { exact: true })
      .selectOption("title");
    await start(page);
    await expect(page.getByLabel("Title row 2")).toHaveValue(title);
  });
  test("website import requires authorization and rejects private networks", async ({
    page,
  }) => {
    await login(page);
    await page.getByRole("button", { name: "Import from website URL" }).click();
    await page
      .getByLabel("Website, product, collection or sitemap URL")
      .fill("http://127.0.0.1/private");
    await page.locator('input[name="authorized"]').check();
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      /Private|Unsafe/,
    );
  });
  test("duplicate resolution requires explicit separate-product confirmation", async ({
    page,
  }) => {
    await login(page);
    const data = {
      ...item(`E2E Duplicate ${Date.now()}`),
      sku: `SKU-${Date.now()}`,
    };
    await upload(page, data);
    await start(page);
    await page
      .getByRole("button", { name: "Approve private draft", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open full listing editor" }),
    ).toBeVisible();
    await upload(page, { ...data, title: `${data.title} second` });
    await start(page);
    await expect(
      page.getByText("Duplicate match", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create separate product", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Confirm",
    );
    await page.getByLabel("I confirm this is a separate product").check();
    await page
      .getByRole("button", { name: "Create separate product", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Approve private draft", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open full listing editor" }),
    ).toBeVisible();
  });
  test("alcohol import remains blocked by missing compliance", async ({
    page,
  }) => {
    await login(page);
    await upload(page, { ...item(`E2E Wine ${Date.now()}`), category: "wine" });
    await start(page);
    await expect(
      page.getByText("Alcohol eligibility review required", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve private draft", exact: true }),
    ).toBeDisabled();
  });
  test("unconfigured connectors are visibly unavailable", async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("button", { name: "Connect Shopify", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Connect WooCommerce", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Nothing publishes automatically.", { exact: false }),
    ).toBeVisible();
  });
});

test("non-alcohol clearance records evidence without publishing", async ({
  page,
  browser,
}) => {
  await login(page);
  const title = `E2E Clearance ${Date.now()}`;
  await upload(page, item(title));
  await start(page);
  await page
    .getByRole("button", { name: "Approve private draft", exact: true })
    .click();
  await page.getByRole("link", { name: "Open full listing editor" }).click();
  await page.locator('select[name="status"]').selectOption("ACTIVE");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect(page).toHaveURL(/error=import_compliance/);
  const adminContext = await browser.newContext();
  await adminContext.addCookies([
    { name: "wt_age_verified", value: "1", url: origin },
    { name: "NEXT_LOCALE", value: "en", url: origin },
  ]);
  const admin = await adminContext.newPage();
  await admin.goto(`${origin}/login?next=/admin/catalog-imports`);
  await admin.locator('input[name="email"]').fill("admin@feelacy.local");
  await admin.locator('input[name="password"]').fill("password123");
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    admin.getByRole("heading", { name: "Imported product compliance review" }),
  ).toBeVisible();
  const section = admin
    .locator("section")
    .filter({ has: admin.getByRole("heading", { name: new RegExp(title) }) });
  for (const checkbox of await section.getByRole("checkbox").all())
    await checkbox.check();
  await section
    .getByLabel("Review evidence / case reference")
    .fill("Local test fixture review evidence; not production clearance.");
  await section
    .getByLabel("Review expiry")
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await section
    .getByRole("button", { name: "Record non-alcohol clearance" })
    .click();
  await expect(admin).toHaveURL(/reviewed=1/);
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Recorded non-alcohol compliance review is current",
  );
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");
  await page.locator('select[name="status"]').selectOption("ACTIVE");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect(page).not.toHaveURL(/error=import_compliance/);
  await expect(page.locator('select[name="status"]')).toHaveValue(
    /ACTIVE|PENDING_REVIEW/,
  );
  await adminContext.close();
});
