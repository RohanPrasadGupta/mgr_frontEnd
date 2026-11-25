import { request, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

export const STATE = "e2e/.auth/state.json";
export const USER_FILE = "e2e/.auth/user.json";

/** One throwaway user per run (sign-ups are rate-limited per IP), shared by every spec through its saved session. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const user = { email: `e2e-${Date.now()}@example.com`, password: `E2e-pass-${Math.random().toString(36).slice(2)}`, name: "E2E User" };
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": process.env.E2E_CLIENT_IP ?? "203.0.113.1" } });
  const res = await ctx.post("/api/auth/register", { data: { ...user, baseCurrency: "THB", timezone: "Asia/Bangkok" } });
  if (res.status() !== 200) throw new Error(`E2E sign-up failed (${res.status()}): ${await res.text()} — is the API running?`);
  mkdirSync("e2e/.auth", { recursive: true });
  await ctx.storageState({ path: STATE });
  writeFileSync(USER_FILE, JSON.stringify(user));
  await ctx.dispose();
}
