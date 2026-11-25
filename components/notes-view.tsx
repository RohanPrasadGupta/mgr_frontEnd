"use client";
import PushPin from "@mui/icons-material/PushPin";
import PushPinOutlined from "@mui/icons-material/PushPinOutlined";
import { useEffect, useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateNotes, useMutate, useNotes } from "@/lib/api/hooks";
import type { Note } from "@/lib/api/types";
import { useConfirm } from "./feedback";
import { RowActions } from "./row-actions";
import { Button, Card, CardsSkeleton, Empty, ErrorNote, Field, Input, Modal, cx } from "./ui";

const when = (iso: string) => new Date(iso).toLocaleString("en", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function NotesView() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const notes = useNotes(q);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const pin = useMutate(({ id, pinned }: { id: string; pinned: boolean }) => call(client.PATCH("/notes/{id}", { params: { path: { id } }, body: { pinned } })), invalidateNotes);
  const remove = useMutate((id: string) => call(client.DELETE("/notes/{id}", { params: { path: { id } } })), invalidateNotes, "Note deleted");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <Button onClick={() => setEditing("new")}>+ New note</Button>
      </div>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
      {notes.isPending ? <CardsSkeleton count={3} /> : notes.error ? <ErrorNote error={notes.error} retry={() => notes.refetch()} /> : notes.data.length === 0 ? (
        <Empty>{q ? "No notes match your search." : "No notes yet. Jot down money plans, account details you need to remember, or a shopping list."}</Empty>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.data.map((n) => (
            <Card key={n.id} className={cx("flex flex-col gap-2", n.pinned && "border-primary/50")}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setEditing(n)} className="min-w-0 text-left"><h2 className="truncate font-semibold">{n.title}</h2></button>
                <button type="button" onClick={() => pin.mutate({ id: n.id, pinned: !n.pinned })} aria-pressed={n.pinned} aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
                  className={cx("shrink-0", n.pinned ? "text-primary" : "text-muted hover:text-fg")}>{n.pinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}</button>
              </div>
              {n.body && <button type="button" onClick={() => setEditing(n)} className="line-clamp-5 whitespace-pre-line text-left text-sm text-muted">{n.body}</button>}
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-1.5 text-xs text-muted">
                <span>Edited {when(n.updatedAt)}</span>
                <RowActions label={`note ${n.title}`} onEdit={() => setEditing(n)}
                  onDelete={async () => { if (await confirm({ title: "Delete note?", message: `Delete "${n.title}"? This can't be undone.`, destructive: true })) remove.mutate(n.id); }} />
              </div>
            </Card>
          ))}
        </div>
      )}
      <NoteDialog state={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function NoteDialog({ state, onClose }: { state: Note | "new" | null; onClose: () => void }) {
  const edit = state && state !== "new" ? state : null;
  const [error, setError] = useState<string | null>(null);
  const save = useMutate((b: { title: string; body: string; pinned: boolean }) => (edit
    ? call(client.PATCH("/notes/{id}", { params: { path: { id: edit.id } }, body: b }))
    : call(client.POST("/notes", { body: b }))), invalidateNotes, edit ? "Note saved" : "Note created");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    try { await save.mutateAsync({ title: String(f.get("title")).trim(), body: String(f.get("body") ?? ""), pinned: f.get("pinned") === "on" }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={state !== null} onClose={onClose} title={edit ? "Edit note" : "New note"}>
      <form key={edit?.id ?? "new"} onSubmit={submit} className="space-y-3">
        <Field label="Title"><Input name="title" required maxLength={120} defaultValue={edit?.title} autoFocus /></Field>
        <Field label="Note">
          <textarea name="body" rows={8} maxLength={20_000} defaultValue={edit?.body}
            className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-[var(--ring)]" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" defaultChecked={edit?.pinned} className="size-4 accent-[var(--primary)]" />Pin to the top</label>
        {error && <ErrorNote error={new Error(error)} />}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}
