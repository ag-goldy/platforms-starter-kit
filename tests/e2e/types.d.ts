/**
 * Type declarations for Playwright tests
 * This file provides type definitions when @playwright/test is not installed
 */

declare module '@playwright/test' {
  export interface Page {
    goto(url: string): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    click(selector: string): Promise<void>;
    waitForURL(url: string | RegExp): Promise<void>;
    url(): string;
    locator(selector: string): {
      first(): { count(): Promise<number>; click(): Promise<void>; };
      count(): Promise<number>;
    };
    getByRole(role: string, options?: { name?: RegExp | string }): {
      click(): Promise<void>;
      check(): Promise<void>;
      first(): { click(): Promise<void>; };
    };
    getByLabel(label: string): {
      fill(value: string): Promise<void>;
    };
    getByText(text: string | RegExp): {
      click(): Promise<void>;
      first(): { click(): Promise<void>; };
    };
    waitForTimeout(ms: number): Promise<void>;
  }
  
  export interface TestInfo {
    skip(reason?: string): void;
  }
  
  export interface TestType {
    describe(name: string, fn: () => void): void;
    beforeEach(fn: (args: { page: Page }) => Promise<void>): void;
    (name: string, fn: (args: { page: Page }) => Promise<void>): void;
    skip(reason?: string): void;
  }
  
  export const test: TestType;
  
  export interface ExpectMatcher {
    toHaveURL(url: string | RegExp): Promise<void>;
    not: { toHaveURL(url: string | RegExp): Promise<void>; };
    toContainText(text: string | RegExp): Promise<void>;
    toBeVisible(options?: { timeout?: number }): Promise<void>;
    toBeEnabled(): Promise<void>;
    toHaveValue(value: string): Promise<void>;
    toHaveCount(count: number): Promise<void>;
  }
  
  export function expect(value: unknown): ExpectMatcher;
}
