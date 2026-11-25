"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateTags, useMutate, useTags } from "@/lib/api/hooks";
import { cx } from "./ui";

/** Toggleable tag chips plus an inline "new tag" field. Controlled: `value` is the selected tag ids. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const tags = useTags();
  const [draft, setDraft] = useState("");
  const create = useMutate((name: string) => call(client.POST("/tags", { body: { name } })), invalidateTags);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  async function add() {
    const name = draft.trim();
    if (!name) return;
    const existing = tags.data?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) { if (!value.includes(existing.id)) onChange([...value, existing.id]); setDraft(""); return; }
    try { const t = await create.mutateAsync(name); onChange([...value, t.data.id]); setDraft(""); } catch { /* toast already shown */ }
  }

  return (
    <div className="space-y-2">
      {(tags.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags">
          {tags.data!.map((t) => {
            const on = value.includes(t.id);
            return (
              <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)}
                className={cx("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:text-fg")}>
                #{t.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="New tag" aria-label="New tag"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-primary" />
        <button type="button" onClick={() => void add()} disabled={!draft.trim() || create.isPending} className="shrink-0 rounded-lg border border-border px-3 text-sm font-medium hover:bg-border/40 disabled:opacity-50">Add</button>
      </div>
    </div>
  );
}
