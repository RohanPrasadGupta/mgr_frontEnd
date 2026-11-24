"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import type { Body } from "@/lib/api/types";
import { qk, useCategories, useMutate } from "@/lib/api/hooks";
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, Segmented, Skeleton } from "./ui";

const refresh = (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries({ queryKey: qk.categories });

export function CategoriesView() {
  const categories = useCategories();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [error, setError] = useState<string | null>(null);
  const create = useMutate((body: Body<"/categories", "post">) => call(client.POST("/categories", { body })), refresh);
  const remove = useMutate((id: string) => call(client.DELETE("/categories/{id}", { params: { path: { id } } })), refresh);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    try { await create.mutateAsync({ name: String(f.get("name")).trim(), kind, icon: String(f.get("icon") || "").trim() || undefined }); setOpen(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Button onClick={() => { setError(null); setOpen(true); }}>+ Add category</Button>
      </div>
      {categories.isPending ? <Skeleton className="h-48" /> : categories.error ? <ErrorNote error={categories.error} retry={() => categories.refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {(["expense", "income"] as const).map((k) => {
            const items = categories.data.filter((c) => c.kind === k);
            return (
              <Card key={k}>
                <h2 className="mb-2 flex justify-between text-sm font-semibold capitalize"><span>{k}</span><span className="font-normal text-muted">{items.length}</span></h2>
                {items.length === 0 ? <Empty>None yet.</Empty> : (
                  <ul className="divide-y divide-border">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="truncate"><span aria-hidden className="mr-2">{c.icon ?? "•"}</span>{c.name}</span>
                        <button className="text-xs text-muted underline hover:text-expense" onClick={() => confirm(`Delete "${c.name}"? Existing transactions keep their history.`) && remove.mutate(c.id)}>Delete</button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add category">
        <form onSubmit={submit} className="space-y-3">
          <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Expense", tone: "expense" }, { value: "income", label: "Income", tone: "income" }]} />
          <Field label="Name"><Input name="name" required maxLength={60} autoFocus /></Field>
          <Field label="Icon (emoji)" hint="Optional"><Input name="icon" maxLength={8} /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>Add</Button></div>
        </form>
      </Modal>
    </div>
  );
}
