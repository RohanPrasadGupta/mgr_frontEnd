import { expect, settled, test } from "./fixtures";

test("signed-out visitors are sent to sign in; sign in → dashboard → sign out", async ({ page, context, user }) => {
  await context.clearCookies(); // signed out in THIS test only (logging out would revoke the shared session)
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await settled(page);
  await expect(page.getByText(/Please confirm/)).toBeVisible(); // new accounts are unverified
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error and keeps the user on the sign-in page", async ({ page, context, user }) => {
  await context.clearCookies(); // signed out in THIS test only (logging out would revoke the shared session)
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible(); // (Next also renders an empty route-announcer alert)
  await expect(page).toHaveURL(/\/login$/);
});

test("forgot password page answers neutrally", async ({ page, context, user }) => {
  await context.clearCookies(); // signed out in THIS test only (logging out would revoke the shared session)
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("someone-else@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  void user;
});
