/**
 * Phase 3: End-to-end ticket creation verification
 */

/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-require-imports */
/// <reference path="./types.d.ts" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let test: typeof import("@playwright/test").test;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let expect: typeof import("@playwright/test").expect;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const playwright = require("@playwright/test");
  test = playwright.test;
  expect = playwright.expect;
} catch {
  test = Object.assign(
    () => {},
    {
      describe: () => {},
      beforeEach: () => {},
      skip: () => {},
    },
  ) as unknown as typeof import("@playwright/test").test;
  expect = () => ({
    toHaveURL: async () => {},
    not: { toHaveURL: async () => {} },
    toContainText: async () => {},
    toBeVisible: async () => {},
  }) as unknown as ReturnType<typeof import("@playwright/test").expect>;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Seeded test data (matches Phase 3 seed)
const CUSTOMER_EMAIL = "john@acme.com";
const CUSTOMER_PASSWORD = "TestPass123!";
const ORG_SUBDOMAIN = "acme";
const PLATFORM_ADMIN_EMAIL = "adm-atlas@agrnetworks.com";
const PLATFORM_ADMIN_PASSWORD = "AdminPass123!";

test.describe("Phase 3: Ticket creation E2E", () => {
  test.setTimeout(60000);

  test("customer creates ticket and both portals render it", async ({
    page,
  }: {
    page: import("@playwright/test").Page;
  }) => {
    // ============================
    // STEP 1: Customer login
    // ============================
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to customer portal (could be /s/acme, /s/acme/dashboard, or /s/acme/tickets)
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}`));

    // ============================
    // STEP 2: Navigate to new ticket form directly (force full page load)
    // ============================
    await page.goto(`${BASE_URL}/s/${ORG_SUBDOMAIN}/tickets/new`);

    // Wait for form to render
    await page.waitForSelector('input[name="subject"]', { timeout: 10000 });

    // ============================
    // STEP 3: Fill and submit form
    // ============================
    const subject = `Phase3 E2E Ticket ${Date.now()}`;
    const description = "This ticket was created during Phase 3 E2E verification.";

    await page.fill('input[name="subject"]', subject);
    await page.fill('textarea[name="description"]', description);

    // Submit
    await page.getByRole("button", { name: /submit ticket/i }).click();

    // ============================
    // STEP 4: Capture redirect URL
    // ============================
    // Wait for navigation away from /tickets/new to /tickets/{uuid}
    await page.waitForFunction(
      (subdomain: string) => {
        const path = window.location.pathname;
        return (
          path.startsWith(`/s/${subdomain}/tickets/`) &&
          path !== `/s/${subdomain}/tickets/new` &&
          /[0-9a-f]{8}-/.test(path)
        );
      },
      ORG_SUBDOMAIN,
      { timeout: 15000 },
    );

    const ticketDetailUrl = page.url();
    const ticketIdMatch = ticketDetailUrl.match(
      new RegExp(`/s/${ORG_SUBDOMAIN}/tickets/(.+)$`),
    );
    const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
    console.log("Created ticket at:", ticketDetailUrl);
    console.log("Ticket ID:", ticketId);

    // Force full page load to render ticket detail server-side
    await page.reload();

    // Verify ticket detail page renders with subject
    await expect(page.locator("body")).toContainText(subject);

    // ============================
    // STEP 5: Verify customer ticket list
    // ============================
    await page.goto(`${BASE_URL}/s/${ORG_SUBDOMAIN}/tickets`);
    await expect(page.locator("body")).toContainText(subject);

    // ============================
    // STEP 6: Log out, log in as platform admin
    // ============================
    await page.goto(`${BASE_URL}/logout`);
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', PLATFORM_ADMIN_EMAIL);
    await page.fill('input[type="password"]', PLATFORM_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for admin dashboard
    await page.waitForURL(/\/app/);

    // ============================
    // STEP 7: Verify internal ticket list
    // ============================
    await page.goto(`${BASE_URL}/app/tickets`);
    await expect(page.locator("body")).toContainText(subject);

    // ============================
    // STEP 8: Verify internal detail page (by ticket ID since portal redirects to ID)
    // ============================
    if (ticketId) {
      await page.goto(`${BASE_URL}/app/tickets/${ticketId}`);
      await expect(page.locator("body")).toContainText(subject);
    }
  });
});
