import { describe, it, expect } from "vitest";
import {
  checkInternalRole,
  AuthorizationError,
} from "@/lib/auth/permissions";

describe("checkInternalRole", () => {
  it("allows ADMIN when ADMIN is required", () => {
    expect(() => checkInternalRole("ADMIN", ["ADMIN"])).not.toThrow();
  });

  it("allows AGENT when AGENT is in allowedRoles", () => {
    expect(() => checkInternalRole("AGENT", ["AGENT", "ADMIN"])).not.toThrow();
  });

  it("throws when role is not in allowedRoles", () => {
    expect(() => checkInternalRole("AGENT", ["ADMIN"])).toThrow(
      AuthorizationError,
    );
  });

  it("allows any role when allowedRoles is empty", () => {
    expect(() => checkInternalRole("READONLY", [])).not.toThrow();
  });

  it("allows any role when allowedRoles is undefined", () => {
    expect(() => checkInternalRole("AGENT", undefined)).not.toThrow();
  });

  it("throws for customer roles even if somehow passed", () => {
    expect(() => checkInternalRole("REQUESTER", ["ADMIN", "AGENT"])).toThrow(
      AuthorizationError,
    );
  });
});
