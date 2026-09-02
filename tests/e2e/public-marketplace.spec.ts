import { expect, test } from "@playwright/test";

test("public marketplace renders and exposes search", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/WineTreff/i);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("textbox").first()).toBeVisible();
});

test("health endpoint reports a boolean service status", async ({ request }) => {
  const response = await request.get("/api/health");
  expect([200, 503]).toContain(response.status());
  const body = await response.json();
  expect(typeof body.ok).toBe("boolean");
});
