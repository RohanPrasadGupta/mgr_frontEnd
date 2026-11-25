import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Providers } from "@/app/providers";
import { render } from "@testing-library/react";
import { call, client } from "@/lib/api/client";
import { useMutate } from "@/lib/api/hooks";
import { errorResponse, mockFetch } from "@/test/utils";
import { useConfirm } from "./feedback";

function Probe({ path }: { path: string }) {
  const confirm = useConfirm();
  const save = useMutate(() => call(client.POST("/categories", { body: { name: "x", kind: "expense" } })), async () => {}, "Category added");
  return (
    <>
      <button onClick={() => save.mutate(undefined as never)}>save</button>
      <button onClick={async () => { document.title = (await confirm({ message: `ok ${path}`, destructive: true })) ? "yes" : "no"; }}>ask</button>
    </>
  );
}

describe("feedback: toasts", () => {
  it("shows a success snackbar when a write succeeds", async () => {
    mockFetch({ "POST /categories": { data: {} } });
    render(<Providers><Probe path="a" /></Providers>);
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findByText("Category added")).toBeInTheDocument();
  });
  it("shows the API's message in an error snackbar when a write fails", async () => {
    mockFetch({ "POST /categories": () => errorResponse(409, "conflict", "A category with that name already exists") });
    render(<Providers><Probe path="a" /></Providers>);
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A category with that name already exists");
    expect(screen.queryByText("Category added")).not.toBeInTheDocument();
  });
});

describe("feedback: confirm dialog", () => {
  it("resolves true on confirm and false on cancel / Escape", async () => {
    mockFetch({});
    render(<Providers><Probe path="b" /></Providers>);
    await userEvent.click(screen.getByRole("button", { name: "ask" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("ok b");
    await userEvent.click(within(dlg).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(document.title).toBe("yes"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "ask" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.title).toBe("no"));
  });
});
