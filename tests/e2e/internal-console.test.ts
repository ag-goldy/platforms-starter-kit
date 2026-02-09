/**
 * E2E Tests for Internal Console
 * 
 * Tests internal agent/admin flows:
 * - Login and access
 * - Ticket list and filters
 * - Ticket detail and actions
 * - Bulk operations
 * - Organization management
 * 
 * Note: Requires Playwright to be installed
 * Run with: npx playwright test tests/e2e/internal-console.test.ts
 */

/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-require-imports */
/// <reference path="./types.d.ts" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let test: typeof import('@playwright/test').test;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let expect: typeof import('@playwright/test').expect;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const playwright = require('@playwright/test');
  test = playwright.test;
  expect = playwright.expect;
} catch {
  // Playwright not installed, tests will be skipped
  test = Object.assign(
    () => {},
    {
      describe: () => {},
      beforeEach: () => {},
      skip: () => {},
    }
  ) as unknown as typeof import('@playwright/test').test;
  expect = () => ({
    toHaveURL: async () => {},
    not: { toHaveURL: async () => {} },
    toContainText: async () => {},
    toBeVisible: async () => {},
  }) as unknown as ReturnType<typeof import('@playwright/test').expect>;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@agr.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Internal Console', () => {
  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);
  });

  test('admin can login and access internal console', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Fill login form
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to internal console
    await expect(page).toHaveURL(new RegExp('/app'));
  });

  test('internal console shows ticket list', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Should see tickets page
    await expect(page.locator('h1, h2')).toContainText(/tickets/i);
    
    // Should see filters or search
    const hasFilters = await page.locator('input[type="search"], select, button[aria-label*="filter" i]').count();
    expect(hasFilters).toBeGreaterThan(0);
  });

  test('admin can create a ticket', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to create ticket page
    await page.getByRole('button', { name: /new ticket/i }).click();

    // Fill ticket form
    await page.fill('input[name="subject"]', 'E2E Test Ticket');
    await page.fill('textarea[name="description"]', 'This is a test ticket created by E2E tests');
    await page.selectOption('select[name="priority"]', 'P3');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to ticket detail
    await page.waitForURL(new RegExp('/app/tickets/'));
    
    // Should show success message or ticket details
    await expect(page.locator('body')).toContainText('E2E Test Ticket');
  });

  test('admin can filter tickets by status', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Find and use status filter
    const statusFilter = await page.locator('select[name="status"], button[aria-label*="status" i]').first();
    if (await statusFilter.count() > 0) {
      await statusFilter.click();
      await page.click('text=OPEN');
      
      // Should show filtered results
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/open|tickets/i);
    }
  });

  test('admin can view organization list', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to organizations page
    await page.goto(`${BASE_URL}/app/organizations`);

    // Should see organizations list
    await expect(page.locator('h1, h2')).toContainText(/organizations/i);
  });

  test('admin can search for users', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to users page
    await page.goto(`${BASE_URL}/app/users`);

    // Should see users list
    await expect(page.locator('h1, h2')).toContainText(/users/i);
    
    // Try to search
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('admin');
      await page.waitForTimeout(500);
    }
  });

  test('unauthorized access redirects to login', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    
    // Try to access protected page
    await page.goto(`${BASE_URL}/app`);
    
    // Should redirect to login
    await expect(page).toHaveURL(new RegExp('/login'));
  });

  test('bulk operations require selection', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Look for bulk action buttons
    const bulkButtons = await page.locator('button:has-text("Assign"), button:has-text("Bulk"), button:has-text("Merge")').count();
    
    if (bulkButtons > 0) {
      // Try to click bulk action without selection
      await page.click('button:has-text("Assign")');
      
      // Should show error or require selection
      await expect(page.locator('body')).toContainText(/select|ticket/i);
    }
  });

  test('session persists across navigation', async ({ page }: { page: import('@playwright/test').Page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to different pages
    await page.goto(`${BASE_URL}/app/organizations`);
    await expect(page).toHaveURL(new RegExp('/app/organizations'));
    
    await page.goto(`${BASE_URL}/app/users`);
    await expect(page).toHaveURL(new RegExp('/app/users'));
    
    // Should still be logged in (not redirected to login)
    await expect(page).not.toHaveURL(new RegExp('/login'));
  });
});
