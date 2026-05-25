import { describe, expect, it } from "vitest";
import { renderBase } from "@/lib/email/templates/base";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link";
import { renderPasswordResetConfirmationEmail } from "@/lib/email/templates/password-reset-confirmation";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { renderTicketCreatedEmail } from "@/lib/email/templates/ticket-created";

describe("email base template", () => {
  it("renders a logo image in HTML but not text when logoUrl is provided", () => {
    const rendered = renderBase({
      org: {
        name: "Acme Help",
        logoUrl: "https://example.com/logo.png",
        supportEmail: "support@example.com",
      },
      contentHtml: "<p>Hello</p>",
      contentText: "Hello",
    });

    expect(rendered.html).toContain("<img");
    expect(rendered.html).toContain("https://example.com/logo.png");
    expect(rendered.text).not.toContain("<img");
  });

  it("renders the organization name in bold HTML when logoUrl is missing", () => {
    const rendered = renderBase({
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
      },
      contentHtml: "<p>Hello</p>",
      contentText: "Hello",
    });

    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain("font-weight:700");
    expect(rendered.html).toContain("Acme Help");
  });

  it("uses a custom brand color for the accent line", () => {
    const rendered = renderBase({
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
        brandColor: "#123456",
      },
      contentHtml: "<p>Hello</p>",
      contentText: "Hello",
    });

    expect(rendered.html).toContain("background:#123456");
  });

  it("falls back to the existing AGR orange when brandColor is missing", () => {
    const rendered = renderBase({
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
      },
      contentHtml: "<p>Hello</p>",
      contentText: "Hello",
    });

    expect(rendered.html).toContain("background:#f97316");
  });
});

describe("ticket-created email template", () => {
  it("renders ticket key, subject, and link in both HTML and text", () => {
    const rendered = renderTicketCreatedEmail({
      ticket: {
        key: "ACME-123",
        subject: "Printer is offline",
      },
      ticketUrl: "https://support.example.com/ticket/test-token",
      requester: { name: "Avery" },
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
      },
    });

    expect(rendered.subject).toBe("Ticket received: ACME-123");
    expect(rendered.html).toContain("ACME-123");
    expect(rendered.html).toContain("Printer is offline");
    expect(rendered.html).toContain("https://support.example.com/ticket/test-token");
    expect(rendered.text).toContain("ACME-123");
    expect(rendered.text).toContain("Printer is offline");
    expect(rendered.text).toContain("https://support.example.com/ticket/test-token");
  });

  it('uses "Hi there" when requester name is missing', () => {
    const rendered = renderTicketCreatedEmail({
      ticket: {
        key: "ACME-124",
        subject: "WiFi access",
      },
      ticketUrl: "https://support.example.com/ticket/test-token",
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
      },
    });

    expect(rendered.html).toContain("Hi there,");
    expect(rendered.text).toContain("Hi there,");
  });
});

describe("auth email templates", () => {
  it("renders magic link email with org context in HTML and text", () => {
    const rendered = renderMagicLinkEmail({
      email: "avery@example.com",
      url: "https://atlas.example.com/api/auth/magic-link/verify?token=test",
      expiresInMinutes: 5,
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
        brandColor: "#123456",
      },
    });

    expect(rendered.subject).toBe("Sign in to Acme Help");
    expect(rendered.html).toContain("Click the link below to sign in to Acme Help.");
    expect(rendered.html).toContain('href="https://atlas.example.com/api/auth/magic-link/verify?token=test"');
    expect(rendered.html).toContain(">Sign in to Acme Help</a>");
    expect(rendered.html).not.toContain(">https://atlas.example.com/api/auth/magic-link/verify?token=test</a>");
    expect(rendered.html).toContain("This link will expire in 5 minutes.");
    expect(rendered.text).toContain("Click the link below to sign in to Acme Help.");
    expect(rendered.text).toContain("https://atlas.example.com/api/auth/magic-link/verify?token=test");
    expect(rendered.html).not.toContain("display:inline-block");
    expect(rendered.html).not.toContain("border-radius");
  });

  it("renders magic link email with default org when no org is passed", () => {
    const rendered = renderMagicLinkEmail({
      email: "avery@example.com",
      url: "https://atlas.example.com/api/auth/magic-link/verify?token=test",
    });

    expect(rendered.subject).toBe("Sign in to Atlas");
    expect(rendered.html).toContain("Click the link below to sign in to Atlas.");
    expect(rendered.text).toContain("the AGR Networks team");
  });

  it("renders password reset email in HTML and text", () => {
    const rendered = renderPasswordResetEmail({
      email: "avery@example.com",
      url: "https://atlas.example.com/reset-password/token",
      expiresInMinutes: 60,
      requestedAt: new Date("2026-05-25T05:30:00.000Z"),
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
      },
    });

    expect(rendered.subject).toBe("Reset your password");
    expect(rendered.html).toContain("We received a request to reset the password for avery@example.com.");
    expect(rendered.html).toContain('href="https://atlas.example.com/reset-password/token"');
    expect(rendered.html).toContain(">Reset your password</a>");
    expect(rendered.html).not.toContain(">https://atlas.example.com/reset-password/token</a>");
    expect(rendered.html).toContain("This link will expire in 60 minutes.");
    expect(rendered.html).toContain("Requested at");
    expect(rendered.text).toContain("We received a request to reset the password for avery@example.com.");
    expect(rendered.text).toContain("https://atlas.example.com/reset-password/token");
    expect(rendered.text).toContain("Requested at");
    expect(rendered.text).toContain("your password will remain unchanged");
    expect(rendered.html).not.toContain("display:inline-block");
    expect(rendered.html).not.toContain("border-radius");
  });

  it("renders password reset confirmation email in HTML and text", () => {
    const rendered = renderPasswordResetConfirmationEmail({
      email: "avery@example.com",
      resetAt: new Date("2026-05-25T05:50:00.000Z"),
      org: {
        name: "Acme Help",
        supportEmail: "support@example.com",
      },
    });

    expect(rendered.subject).toBe("Your password was reset");
    expect(rendered.html).toContain("The password for avery@example.com was reset successfully.");
    expect(rendered.html).toContain("Reset at");
    expect(rendered.html).toContain("contact support immediately");
    expect(rendered.text).toContain("The password for avery@example.com was reset successfully.");
    expect(rendered.text).toContain("contact support immediately");
  });
});
