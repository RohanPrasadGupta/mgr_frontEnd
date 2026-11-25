import { expect, settled, test } from "./fixtures";

test("goals, debts, notes and the monthly report", async ({ page, user }) => {
  void user;
  // goal + money added
  await page.goto("/goals");
  await settled(page);
  await page.getByRole("button", { name: "+ New goal" }).click();
  let dlg = page.getByRole("dialog", { name: "New goal" });
  await dlg.getByLabel("Name").fill("Laptop");
  await dlg.getByLabel(/^Target \(/).fill("40000");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Goal created")).toBeVisible();
  await page.getByRole("button", { name: "+ Add money" }).click();
  dlg = page.getByRole("dialog", { name: "Money for Laptop" });
  await dlg.getByLabel(/^Amount/).fill("10000");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("progressbar", { name: "Laptop progress" })).toHaveAttribute("aria-valuenow", "25");

  // debt + repayment to settled
  await page.goto("/debts");
  await settled(page);
  await page.getByRole("button", { name: "+ Record debt" }).click();
  dlg = page.getByRole("dialog", { name: "Record a debt" });
  await dlg.getByLabel("Who owes you?").fill("Ronit");
  await dlg.getByLabel("Amount").fill("500");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Debt summary" })).toContainText("THB 500.00");
  await page.getByRole("button", { name: "Repayment" }).click();
  await page.getByRole("dialog", { name: "Repayment · Ronit" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Nothing outstanding")).toBeVisible();
  await page.getByRole("radio", { name: "Settled" }).click();
  await expect(page.getByText("Settled", { exact: true }).last()).toBeVisible();

  // note
  await page.goto("/notes");
  await settled(page);
  await page.getByRole("button", { name: "+ New note" }).click();
  dlg = page.getByRole("dialog", { name: "New note" });
  await dlg.getByLabel("Title").fill("Tax");
  await dlg.getByLabel("Note").fill("file by March");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("file by March")).toBeVisible();

  // report renders (empty month is fine) and offers export
  await page.goto("/reports");
  await settled(page);
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await page.getByRole("radio", { name: "Yearly" }).click();
  await settled(page);
  await expect(page.getByRole("button", { name: "CSV" })).toBeVisible();
});
