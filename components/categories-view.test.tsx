import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { CategoriesView } from "./categories-view";

describe("CategoriesView", () => {
  it("has an edit and a delete button on every category", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<CategoriesView />);
    await screen.findByText("Salary");
    for (const n of ["Food", "Rent", "Salary"]) {
      expect(screen.getByRole("button", { name: `Edit ${n}` })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Delete ${n}` })).toBeInTheDocument();
    }
  });

  it("deletes only after the confirmation dialog, then toasts", async () => {
    const m = mockFetch({ ...baseRoutes, "DELETE /categories/c-rent": null });
    renderWithClient(<CategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Rent" }));
    const dlg = await screen.findByRole("dialog", { name: "Delete category?" });
    expect(dlg).toHaveTextContent('Delete "Rent"?');
    await userEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(m.last("DELETE", "/categories/c-rent")).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Delete Rent" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/categories/c-rent")).toBeDefined());
  });

  it("renames a category through the edit dialog", async () => {
    const m = mockFetch({ ...baseRoutes, "PATCH /categories/c-rent": { data: {} } });
    renderWithClient(<CategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Rent" }));
    const name = await screen.findByLabelText("Name");
    expect(name).toHaveValue("Rent");
    await userEvent.clear(name);
    await userEvent.type(name, "Housing");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/categories/c-rent")!.body).toMatchObject({ name: "Housing" }));
  });
});
