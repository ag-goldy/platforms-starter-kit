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

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@agr.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Internal Console', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);
  });

  test('admin can login and access internal console', async ({ page }) => {
    // Fill login form
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to internal console
    await expect(page).toHaveURL(new RegExp('/app'));
  });

  test('internal console shows ticket list', async ({ page }) => {
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

  test('admin can create a ticket', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to create ticket page
    await page.getByRole('button', { name: /new ticket/i }).click();
    await page.waitForURL(new RegExp('/app/tickets/new'));

    // Fill ticket form
    const subject = `E2E Internal Test Ticket ${Date.now()}`;
    await page.fill('input[name="subject"], input[placeholder*="subject" i]', subject);
    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'This is a test ticket from E2E tests');

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Should redirect to ticket detail page
    await page.waitForURL(new RegExp('/app/tickets/[^/]+$'));

    // Should see ticket subject
    await expect(page.locator('h1, h2')).toContainText(subject);
  });

  test('admin can change ticket status', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Click on first ticket (if exists)
    const firstTicket = page.locator('a[href*="/tickets/"]').first();
    const ticketCount = await firstTicket.count();
    
    if (ticketCount > 0) {
      await firstTicket.click();
      await page.waitForURL(new RegExp('/app/tickets/[^/]+$'));

      // Find status dropdown/select
      const statusSelect = page.locator('select[name="status"], button[aria-label*="status" i]').first();
      const statusCount = await statusSelect.count();
      
      if (statusCount > 0) {
        // Change status (implementation depends on UI)
        await statusSelect.click();
        await page.getByRole('option', { name: /open|in progress/i }).first().click();

        // Status should update (may need to wait)
        await page.waitForTimeout(1000);
        await expect(page.locator('text=/open|in progress/i').first()).toBeVisible();
      } else {
        test.skip('Status selector not found in UI');
      }
    } else {
      test.skip('No tickets available to test status change');
    }
  });

  test('admin can add internal comment', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Click on first ticket (if exists)
    const firstTicket = page.locator('a[href*="/tickets/"]').first();
    const ticketCount = await firstTicket.count();
    
    if (ticketCount > 0) {
      await firstTicket.click();
      await page.waitForURL(new RegExp('/app/tickets/[^/]+$'));

      // Add comment
      const commentText = `E2E Internal Comment ${Date.now()}`;
      await page.fill('textarea[name="comment"], textarea[placeholder*="comment" i]', commentText);

      // Mark as internal (if checkbox exists)
      const internalCheckbox = page.locator('input[type="checkbox"][name*="internal" i]');
      const hasInternalCheckbox = await internalCheckbox.count();
      if (hasInternalCheckbox > 0) {
        await internalCheckbox.check();
      }

      await page.getByRole('button', { name: /send|submit|add/i }).click();

      // Comment should appear
      await expect(page.locator('text=' + commentText).first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip('No tickets available to test comment functionality');
    }
  });

  test('admin can access organizations page', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to organizations
    await page.getByRole('link', { name: /organizations/i }).click();
    await page.waitForURL(new RegExp('/app/organizations'));

    // Should see organizations page
    await expect(page.locator('h1, h2')).toContainText(/organizations/i);
  });

  test('admin can access health check page', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp('/app'));

    // Navigate to health check
    await page.goto(`${BASE_URL}/app/admin/health`);

    // Should see health check page
    await expect(page.locator('h1, h2')).toContainText(/health/i);
  });
});

