import { expect, settled, test } from "./fixtures";

test("add a tagged expense with a receipt, see it in the list, edit it, then delete it via the confirm dialog", async ({ page, user }) => {
  void user;
  await page.goto("/transactions");
  await settled(page);
  await page.getByRole("button", { name: "+ Add" }).click();
  const dlg = page.getByRole("dialog", { name: "Add transaction" });
  await dlg.getByLabel(/^Amount/).fill("123.45");
  await dlg.getByLabel("Category").selectOption({ label: "Food" });
  await dlg.getByLabel("Note").fill("pad thai");
  await dlg.getByLabel("New tag").fill("lunch");
  await dlg.getByLabel("New tag").press("Enter");
  await expect(dlg.getByRole("button", { name: "#lunch" })).toHaveAttribute("aria-pressed", "true");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYGJgYGBAQAeBgICqv1o0gAAAABJRU5ErkJggg==", "base64");
  await dlg.getByLabel("Attach files").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction added")).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: "pad thai" });
  await expect(row).toContainText("−THB 123.45");
  await expect(row).toContainText("#lunch");
  await expect(row.getByLabel("1 attachment")).toBeVisible();

  await row.getByRole("button", { name: "Edit Food" }).click();
  const edit = page.getByRole("dialog", { name: "Edit transaction" });
  await expect(edit.getByRole("img", { name: "receipt.png" })).toBeVisible();
  await edit.getByLabel(/^Amount/).fill("150");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction updated")).toBeVisible();
  await expect(row).toContainText("−THB 150.00");

  await row.getByRole("button", { name: "Delete Food" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete transaction?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete Food" }).click();
  await page.getByRole("dialog", { name: "Delete transaction?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Transaction deleted")).toBeVisible();
  await expect(row).toHaveCount(0);
});
