import { expect, test as base, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { USER_FILE } from "./global-setup";

export interface TestUser { email: string; password: string; name: string }

/** The run's shared user (created in global-setup; the browser context starts signed in as them). */
export const test = base.extend<{ user: TestUser }>({
  user: async ({}, use) => { await use(JSON.parse(readFileSync(USER_FILE, "utf8"))); },
});
export { expect };

/** Wait until loading skeletons are gone (the dev server compiles pages on first visit). */
export async function settled(page: Page) {
  await expect(page.locator(".animate-pulse")).toHaveCount(0, { timeout: 30_000 });
}
