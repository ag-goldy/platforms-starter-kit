# E2E Tests

End-to-end tests for customer portal and internal console flows.

## Setup

These tests use Playwright for browser automation. To set up:

```bash
# Install Playwright
pnpm add -D @playwright/test playwright

# Install browsers
npx playwright install
```

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
npx playwright test tests/e2e/customer-portal.test.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug
```

## Test Files

- `customer-portal.test.ts` - Customer portal flows (login, view tickets, create tickets, add comments)
- `internal-console.test.ts` - Internal console flows (agent actions, ticket management, bulk operations)

## Environment Variables

Tests require:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - Base URL for the application (default: http://localhost:3000)
- Test user credentials (configured in test files)

## Test Data

Tests use seeded data from `db/seed.ts`:
- Admin: `admin@agr.com` / `admin123`
- Customer: `customer@acme.com` / `customer123`
- Organization: "Acme Corporation" (subdomain: `acme`)

## Notes

- Tests should be run against a clean database (or use test isolation)
- Tests clean up after themselves where possible
- Some tests may require manual verification of email delivery

