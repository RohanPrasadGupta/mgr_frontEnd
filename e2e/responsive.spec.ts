import { expect, settled, test } from "./fixtures";

const ROUTES = ["/", "/transactions", "/transfers", "/budgets", "/investments", "/investments/calculator", "/goals", "/debts", "/reports", "/recurring", "/accounts", "/categories", "/notes", "/import", "/settings"];
const WIDTHS = [390, 768, 1024, 1440];

test("no page scrolls sideways at phone, tablet and desktop widths", async ({ page, user }) => {
  void user;
  test.setTimeout(300_000);
  const problems: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ROUTES) {
      await page.goto(route);
      await settled(page);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) problems.push(`${route} @${width}px overflows by ${over}px`);
    }
  }
  expect(problems).toEqual([]);
});

test("small screens use the menu drawer and quick-action speed dial; large screens the sticky sidebar", async ({ page, user }) => {
  void user;
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Quick actions" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("presentation").getByRole("link", { name: "Goals" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.getByRole("button", { name: "Quick actions" })).toBeHidden();
});
