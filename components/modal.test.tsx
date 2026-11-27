import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field, Modal, Select } from "./ui";

const form = (onClose = vi.fn()) => {
  render(<Modal open onClose={onClose} title="Add budget"><Field label="Period"><Select name="period" defaultValue="month"><option value="month">Monthly</option><option value="week">Weekly</option></Select></Field></Modal>);
  return { onClose, dialog: screen.getByRole("dialog", { name: "Add budget" }) };
};

describe("Modal", () => {
  it("stays open when a drop-down opens under the pointer (the browser reports that click on the dialog)", async () => {
    const { onClose, dialog } = form();
    const field = screen.getByRole("combobox", { name: "Period" });
    fireEvent.pointerDown(field);
    fireEvent.click(dialog); // press on the field, release over the new menu → click lands on their common ancestor
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(field);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Weekly" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(field).toHaveTextContent("Weekly");
  });

  it("still closes on a click on the backdrop (pressed and released outside the form)", () => {
    const { onClose, dialog } = form();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape with a menu open closes the menu, not the form", async () => {
    const { dialog } = form();
    await userEvent.click(screen.getByRole("combobox", { name: "Period" }));
    await screen.findByRole("listbox");
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });
});
