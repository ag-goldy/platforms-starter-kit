import { test, expect } from "@playwright/test";

test("smoke test: hit / get 200", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});
