# Next.js Multi-Tenant Example

A production-ready example of a multi-tenant application built with Next.js 15, featuring custom subdomains for each tenant.

## Features

- ✅ Custom subdomain routing with Next.js middleware
- ✅ Tenant-specific content and pages
- ✅ Shared components and layouts across tenants
- ✅ Redis for tenant data storage
- ✅ Admin interface for managing tenants
- ✅ Emoji support for tenant branding
- ✅ Support for local development with subdomains
- ✅ Compatible with Vercel preview deployments

## Tech Stack

- [Next.js 15](https://nextjs.org/) with App Router
- [React 19](https://react.dev/)
- [Upstash Redis](https://upstash.com/) for data storage
- [Tailwind 4](https://tailwindcss.com/) for styling
- [shadcn/ui](https://ui.shadcn.com/) for the design system

## Getting Started

### Prerequisites

- Node.js 18.17.0 or later
- pnpm (recommended) or npm/yarn
- Upstash Redis account (for production)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/vercel/platforms.git
   cd platforms
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with:

   ```
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/agr_support

   # Auth
   NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
   NEXTAUTH_URL=http://localhost:3000

   # Base URLs (for magic links + console links)
   NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
   APP_BASE_URL=http://localhost:3000
   SUPPORT_BASE_URL=http://localhost:3000

   # Magic link security (REQUIRED)
   # Generate with: openssl rand -base64 32
   TOKEN_PEPPER=your-hmac-pepper

   # Export signed URLs (customer exports)
   EXPORT_SIGNED_URL_SECRET=your-hmac-secret

   # SMTP (optional, console fallback available)
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASSWORD=your-password
   SMTP_SECURE=false
   EMAIL_FROM=AGR Support <support@example.com>

   # Blob storage (attachments) - REQUIRED for attachment uploads
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

   # Rate limiting (Upstash Redis, optional but recommended)
   KV_REST_API_URL=your_redis_url
   KV_REST_API_TOKEN=your_redis_token

   # Admin access (optional, comma-separated emails for /app/admin/health)
   INTERNAL_ADMIN_EMAILS=admin@example.com,admin2@example.com

   # Health check email (optional, for SMTP test button)
   HEALTHCHECK_EMAIL_TO=admin@example.com
   SUPPORT_INBOX_EMAIL=support@example.com

   # Inbound email webhook (optional, for email-to-ticket)
   INBOUND_EMAIL_SECRET=your-webhook-secret-token

   # Inbound email webhook (optional, for email-to-ticket)
   INBOUND_EMAIL_SECRET=your-webhook-secret-token
   ```

4. Start the development server:

   ```bash
   pnpm dev
   ```

5. Access the application:
   - Main site: http://localhost:3000
   - Admin panel: http://localhost:3000/admin
   - Tenants: http://[tenant-name].localhost:3000

## Multi-Tenant Architecture

This application demonstrates a subdomain-based multi-tenant architecture where:

- Each tenant gets their own subdomain (`tenant.yourdomain.com`)
- The middleware handles routing requests to the correct tenant
- Tenant data is stored in Redis using a `subdomain:{name}` key pattern
- The main domain hosts the landing page and admin interface
- Subdomains are dynamically mapped to tenant-specific content

The middleware (`middleware.ts`) intelligently detects subdomains across various environments (local development, production, and Vercel preview deployments).

## Deployment

This application is designed to be deployed on Vercel. To deploy:

1. Push your repository to GitHub
2. Connect your repository to Vercel
3. Configure environment variables
4. Deploy

For custom domains, make sure to:

1. Add your root domain to Vercel
2. Set up a wildcard DNS record (`*.yourdomain.com`) on Vercel

## Email-to-Ticket (Inbound Email)

The system supports automatic ticket creation from incoming emails via webhook.

### Setup

1. **Configure your email provider** to send webhooks to:
   ```
   https://yourdomain.com/api/inbound-email
   ```

2. **Set webhook secret** (optional but recommended):
   ```env
   INBOUND_EMAIL_SECRET=your-secret-token
   ```

3. **Supported providers:**
   - **Resend**: Configure inbound email forwarding in Resend dashboard
   - **SendGrid**: Use Inbound Parse webhook
   - **Postmark**: Use Inbound webhook
   - **Mailgun**: Use Routes to forward to webhook
   - **Generic**: Any service that sends JSON with `from`, `subject`, and `text`/`html` fields

### How It Works

1. Email arrives at your support email address
2. Email provider forwards to webhook endpoint
3. System extracts sender, subject, and body
4. System tries to match sender to existing organization (if user exists)
5. Creates ticket in matched org or "Unassigned Intake"
6. Sends confirmation email to sender with magic link
7. Notifies internal support queue

### Webhook Format

The endpoint accepts JSON in various formats. Common fields:
- `from`: Sender email address
- `subject`: Email subject
- `text` or `text-body`: Plain text body
- `html` or `html-body`: HTML body (optional)

## Security Assumptions

- All org scoping happens server-side from subdomain context and session data.
- Magic-link tokens are single-use, purpose-bound, and hashed at rest.
- Attachment downloads are gated by auth/token checks and proxied through the app.
- Public intake abuse checks run server-side before ticket creation.
- Inbound email webhooks should use signature verification (configure `INBOUND_EMAIL_SECRET`).
