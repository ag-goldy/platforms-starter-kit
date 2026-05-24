import { describe, expect, it } from "vitest";
import { renderBase } from "@/lib/email/templates/base";
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

