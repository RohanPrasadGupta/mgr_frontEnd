"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateTags, useMutate, useTags } from "@/lib/api/hooks";
import type { Tag } from "@/lib/api/types";
import { useConfirm } from "./feedback";
import { RowActions } from "./row-actions";
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, Skeleton, SCROLL_LIST, cx } from "./ui";

export function TagsCard() {
  const tags = useTags();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Tag | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useMutate((name: string) => call(client.POST("/tags", { body: { name } })), invalidateTags, "Tag added");
  const update = useMutate(({ id, name }: { id: string; name: string }) => call(client.PATCH("/tags/{id}", { params: { path: { id } }, body: { name } })), invalidateTags, "Tag renamed");
  const remove = useMutate((id: string) => call(client.DELETE("/tags/{id}", { params: { path: { id } } })), invalidateTags, "Tag deleted");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    try { if (editing === "new") await create.mutateAsync(name); else if (editing) await update.mutateAsync({ id: editing.id, name }); setEditing(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Tags <span className="font-normal text-muted">· labels across categories, e.g. #trip, #work</span></h2>
        <Button variant="ghost" onClick={() => { setError(null); setEditing("new"); }}>+ Tag</Button>
      </div>
      {tags.isPending ? <Skeleton className="h-16" /> : tags.error ? <ErrorNote error={tags.error} retry={() => tags.refetch()} /> : tags.data.length === 0 ? <Empty>No tags yet. Add one here or while entering a transaction.</Empty> : (
        <ul className={cx("divide-y divide-border", SCROLL_LIST)}>
          {tags.data.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate"><span className="text-primary">#</span>{t.name} <span className="text-xs text-muted">· {t.usageCount} use{t.usageCount === 1 ? "" : "s"}</span></span>
              <RowActions label={`tag ${t.name}`} onEdit={() => { setError(null); setEditing(t); }}
                onDelete={async () => { if (await confirm({ title: "Delete tag?", message: `Delete #${t.name}? It is removed from ${t.usageCount} transaction${t.usageCount === 1 ? "" : "s"}; the transactions themselves stay.`, destructive: true })) remove.mutate(t.id); }} />
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New tag" : "Rename tag"}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name"><Input name="name" key={editing === "new" ? "new" : editing?.id} defaultValue={editing && editing !== "new" ? editing.name : ""} required maxLength={40} autoFocus /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={create.isPending || update.isPending}>Save</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
