import { request, type FullConfig } from "@playwright/test";
import { readFileSync, rmSync } from "node:fs";
import { USER_FILE } from "./global-setup";

/** Delete the run's user (and everything it created) through a fresh sign-in. */
export default async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  let user: { email: string; password: string };
  try { user = JSON.parse(readFileSync(USER_FILE, "utf8")); } catch { return; }
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": process.env.E2E_CLIENT_IP ?? "203.0.113.1" } });
  await ctx.post("/api/auth/login", { data: { email: user.email, password: user.password } });
  const res = await ctx.delete("/api/v1/me", { data: { password: user.password } });
  if (res.status() !== 204) console.warn(`E2E teardown: could not delete ${user.email} (${res.status()})`);
  await ctx.dispose();
  rmSync("e2e/.auth", { recursive: true, force: true });
}
