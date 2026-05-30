import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    addToast: vi.fn(),
    removeToast: vi.fn(),
    toasts: [],
  }),
}));

vi.mock("./actions", () => ({
  updateNotificationPreferences: vi.fn(),
}));

describe("notification preferences form", () => {
  it("exports the form component and default preferences", async () => {
    const mod = await import(
      "@/app/app/settings/notifications/notification-preferences-form"
    );
    expect(mod.NotificationPreferencesForm).toBeInstanceOf(Function);
    expect(mod.DEFAULT_PREFERENCES).toBeDefined();
  });

  it("default preferences match schema defaults", async () => {
    const { DEFAULT_PREFERENCES } = await import(
      "@/app/app/settings/notifications/notification-preferences-form"
    );

    expect(DEFAULT_PREFERENCES.emailEnabled).toBe(true);
    expect(DEFAULT_PREFERENCES.emailTicketAssigned).toBe(true);
    expect(DEFAULT_PREFERENCES.emailTicketStatusChanged).toBe(false);
    expect(DEFAULT_PREFERENCES.emailCommentAdded).toBe(true);
    expect(DEFAULT_PREFERENCES.emailMention).toBe(true);
    expect(DEFAULT_PREFERENCES.emailSlaBreach).toBe(true);
    expect(DEFAULT_PREFERENCES.emailDigestFrequency).toBe("daily");

    expect(DEFAULT_PREFERENCES.inappEnabled).toBe(true);
    expect(DEFAULT_PREFERENCES.inappTicketAssigned).toBe(true);
    expect(DEFAULT_PREFERENCES.inappTicketStatusChanged).toBe(true);
    expect(DEFAULT_PREFERENCES.inappCommentAdded).toBe(true);
    expect(DEFAULT_PREFERENCES.inappMention).toBe(true);
    expect(DEFAULT_PREFERENCES.inappSlaBreach).toBe(true);

    expect(DEFAULT_PREFERENCES.pushEnabled).toBe(false);
    expect(DEFAULT_PREFERENCES.pushTicketAssigned).toBe(false);
    expect(DEFAULT_PREFERENCES.pushTicketStatusChanged).toBe(false);
    expect(DEFAULT_PREFERENCES.pushCommentAdded).toBe(false);
    expect(DEFAULT_PREFERENCES.pushMention).toBe(false);
    expect(DEFAULT_PREFERENCES.pushSlaBreach).toBe(false);
  });

  it("default preferences include all required update keys", async () => {
    const { DEFAULT_PREFERENCES } = await import(
      "@/app/app/settings/notifications/notification-preferences-form"
    );

    const expectedKeys = [
      "emailEnabled",
      "emailTicketAssigned",
      "emailTicketStatusChanged",
      "emailCommentAdded",
      "emailMention",
      "emailSlaBreach",
      "emailDigestFrequency",
      "inappEnabled",
      "inappTicketAssigned",
      "inappTicketStatusChanged",
      "inappCommentAdded",
      "inappMention",
      "inappSlaBreach",
      "pushEnabled",
      "pushTicketAssigned",
      "pushTicketStatusChanged",
      "pushCommentAdded",
      "pushMention",
      "pushSlaBreach",
    ];

    const actualKeys = Object.keys(DEFAULT_PREFERENCES).sort();
    expect(actualKeys).toEqual(expectedKeys.sort());
  });

  it("page component exports default server component", async () => {
    const mod = await import("@/app/app/settings/notifications/page");
    expect(mod.default).toBeInstanceOf(Function);
  });
});
