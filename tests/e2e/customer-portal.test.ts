/**
 * E2E Tests for Customer Portal
 * 
 * Tests customer-facing flows:
 * - Login and redirect
 * - View tickets
 * - Create tickets
 * - Add comments
 * - Organization isolation
 * 
 * Note: Requires Playwright to be installed
 * Run with: npx playwright test tests/e2e/customer-portal.test.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CUSTOMER_EMAIL = 'customer@acme.com';
const CUSTOMER_PASSWORD = 'customer123';
const ORG_SUBDOMAIN = 'acme';

test.describe('Customer Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);
  });

  test('customer can login and is redirected to portal', async ({ page }) => {
    // Fill login form
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to customer portal
    await expect(page).toHaveURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets`));
  });

  test('customer sees tickets list page', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets`));

    // Should see tickets page heading
    await expect(page.locator('h1, h2')).toContainText(/tickets/i);
    
    // Should see "New Ticket" button
    await expect(page.getByRole('button', { name: /new ticket/i })).toBeVisible();
  });

  test('customer can create a new ticket', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets`));

    // Click "New Ticket"
    await page.getByRole('button', { name: /new ticket/i }).click();
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets/new`));

    // Fill ticket form
    const subject = `E2E Test Ticket ${Date.now()}`;
    await page.fill('input[name="subject"], input[placeholder*="subject" i]', subject);
    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'This is a test ticket from E2E tests');

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Should redirect to ticket detail page
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets/[^/]+$`));

    // Should see ticket subject
    await expect(page.locator('h1, h2')).toContainText(subject);
  });

  test('customer can add a comment to a ticket', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets`));

    // Click on first ticket (if exists)
    const firstTicket = page.locator('a[href*="/tickets/"]').first();
    const ticketCount = await firstTicket.count();
    
    if (ticketCount > 0) {
      await firstTicket.click();
      await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets/[^/]+$`));

      // Add comment
      const commentText = `E2E Test Comment ${Date.now()}`;
      await page.fill('textarea[name="comment"], textarea[placeholder*="reply" i], textarea[placeholder*="comment" i]', commentText);
      await page.getByRole('button', { name: /send|reply|submit/i }).click();

      // Comment should appear (may need to wait for refresh)
      await expect(page.locator('text=' + commentText).first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip('No tickets available to test comment functionality');
    }
  });

  test('customer cannot access internal console', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets`));

    // Try to access internal console
    await page.goto(`${BASE_URL}/app`);

    // Should be redirected away from /app
    await expect(page).not.toHaveURL(new RegExp('/app'));
  });

  test('customer cannot access other org subdomains', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp(`/s/${ORG_SUBDOMAIN}/tickets`));

    // Try to access different org subdomain
    await page.goto(`${BASE_URL}/s/other-org/tickets`);

    // Should show error or redirect
    // (Exact behavior depends on implementation - could be 404, redirect, or error message)
    const url = page.url();
    expect(url).not.toContain('/s/other-org/tickets');
  });
});

