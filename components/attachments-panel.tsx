"use client";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { attachmentUrl, call, client, uploadAttachment } from "@/lib/api/client";
import { useAttachments } from "@/lib/api/hooks";
import { toast } from "@/lib/toast";
import { useConfirm } from "./feedback";
import { Skeleton } from "./ui";

export const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
export const MAX_BYTES = 10 * 1024 * 1024;
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Client-side pre-check so obviously wrong files fail instantly (the API re-checks the real bytes). */
export function checkFile(f: File): string | null {
  if (f.size > MAX_BYTES) return `${f.name} is larger than 10 MB`;
  if (f.type && !ACCEPT.split(",").includes(f.type)) return `${f.name}: only photos (JPEG, PNG, WebP, HEIC) and PDFs can be attached`;
  return null;
}

function Picker({ onFiles, busy }: { onFiles: (f: File[]) => void; busy?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={ACCEPT} multiple hidden aria-label="Attach files" onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary disabled:opacity-50">
        <AttachFileRounded fontSize="small" />{busy ? "Uploading…" : "Attach receipt"}
      </button>
    </>
  );
}

/** Attachments of a saved transaction: thumbnails/links, upload, delete. */
export function AttachmentsPanel({ transactionId }: { transactionId: string }) {
  const list = useAttachments(transactionId);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["transactions"] })]);

  async function add(files: File[]) {
    setBusy(true);
    try {
      for (const f of files) {
        const bad = checkFile(f);
        if (bad) { toast.error(bad); continue; }
        try { await uploadAttachment(transactionId, f); toast.success(`Attached ${f.name}`); } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
      }
    } finally { setBusy(false); await refresh(); }
  }
  async function remove(id: string, name: string) {
    if (!(await confirm({ title: "Remove attachment?", message: `Delete "${name}"? This can't be undone.`, destructive: true }))) return;
    try { await call(client.DELETE("/attachments/{id}", { params: { path: { id } } })); toast.success("Attachment removed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't remove it"); }
    await refresh();
  }

  return (
    <div className="space-y-2">
      {list.isPending ? <Skeleton className="h-12" /> : (list.data?.length ?? 0) > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.data!.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-lg border border-border bg-bg">
              <a href={attachmentUrl(a.id)} target="_blank" rel="noopener noreferrer" className="block" title={`${a.fileName} · ${size(a.sizeBytes)}`}>
                {a.contentType.startsWith("image/") && a.contentType !== "image/heic"
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin file, not a static asset
                  ? <img src={attachmentUrl(a.id)} alt={a.fileName} loading="lazy" className="aspect-square w-full object-cover" />
                  : <span className="grid aspect-square place-items-center text-muted"><PictureAsPdfOutlined /><span className="sr-only">{a.fileName}</span></span>}
                <span className="block truncate px-1.5 py-1 text-[11px] text-muted">{a.fileName}</span>
              </a>
              <button type="button" onClick={() => void remove(a.id, a.fileName)} aria-label={`Remove ${a.fileName}`}
                className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-card/90 text-muted shadow hover:text-expense"><DeleteOutlined sx={{ fontSize: 16 }} /></button>
            </li>
          ))}
        </ul>
      )}
      <Picker onFiles={(f) => void add(f)} busy={busy} />
    </div>
  );
}

/** For a transaction that doesn't exist yet: files are held locally and uploaded right after it is saved. */
export function PendingAttachments({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <span className="truncate">{f.name} <span className="text-xs text-muted">· {size(f.size)}</span></span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-muted hover:text-expense"><DeleteOutlined sx={{ fontSize: 16 }} /></button>
            </li>
          ))}
        </ul>
      )}
      <Picker onFiles={(add) => {
        const ok = add.filter((f) => { const bad = checkFile(f); if (bad) toast.error(bad); return !bad; });
        onChange([...files, ...ok].slice(0, 10));
      }} />
    </div>
  );
}
