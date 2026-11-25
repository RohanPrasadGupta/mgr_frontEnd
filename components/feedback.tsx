"use client";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast, type ToastKind } from "@/lib/toast";

export interface ConfirmOptions { title?: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
type Confirm = (o: ConfirmOptions) => Promise<boolean>;

// Without a provider (isolated tests, storybook) fall back to the browser's confirm so nothing is ever skipped silently.
const fallback: Confirm = async (o) => (typeof window !== "undefined" ? window.confirm(typeof o.message === "string" ? o.message : (o.title ?? "Are you sure?")) : false);
const Ctx = createContext<Confirm>(fallback);

/** `const confirm = useConfirm(); if (!(await confirm({ message: "Delete?", destructive: true }))) return;` */
export const useConfirm = () => useContext(Ctx);

interface ToastItem { id: number; kind: ToastKind; message: string }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  // ── confirm dialog ──
  const [dlg, setDlg] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback<Confirm>((o) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // a second request supersedes an unanswered one
    resolver.current = resolve;
    setDlg({ ...o, open: true });
  }), []);
  const answer = (v: boolean) => { resolver.current?.(v); resolver.current = null; setDlg((d) => (d ? { ...d, open: false } : d)); };

  // ── snackbar queue (one at a time, newest waits its turn so none are lost) ──
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  useEffect(() => toast.subscribe((kind, message) => setQueue((q) => (q.some((t) => t.message === message && t.kind === kind) ? q : [...q, { id: ++seq.current, kind, message }]))), []);
  useEffect(() => {
    if (queue.length && !current) { setCurrent(queue[0]!); setQueue((q) => q.slice(1)); setOpen(true); }
    else if (queue.length && current && open) setOpen(false); // hurry the visible one along when more are waiting
  }, [queue, current, open]);

  const value = useMemo(() => confirm, [confirm]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={!!dlg?.open} onClose={() => answer(false)} aria-labelledby="confirm-title" aria-describedby="confirm-body" maxWidth="xs" fullWidth slotProps={{ transition: { onExited: () => setDlg(null) } }}>
        <DialogTitle id="confirm-title" sx={{ fontWeight: 700 }}>{dlg?.title ?? (dlg?.destructive ? "Delete this?" : "Are you sure?")}</DialogTitle>
        <DialogContent><DialogContentText id="confirm-body" component="div" sx={{ whiteSpace: "pre-line" }}>{dlg?.message}</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => answer(false)} variant="text" sx={{ color: "var(--fg)" }}>{dlg?.cancelLabel ?? "Cancel"}</Button>
          <Button onClick={() => answer(true)} variant="contained" color={dlg?.destructive ? "error" : "primary"} autoFocus>{dlg?.confirmLabel ?? (dlg?.destructive ? "Delete" : "Confirm")}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar key={current?.id} open={open} autoHideDuration={current?.kind === "error" ? 7000 : 3500} onClose={(_, reason) => { if (reason !== "clickaway") setOpen(false); }}
        slotProps={{ transition: { onExited: () => setCurrent(null) } }} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} sx={{ bottom: { xs: 88, md: 24 } }}>
        <Alert variant="filled" severity={current?.kind ?? "info"} onClose={() => setOpen(false)} role={current?.kind === "error" ? "alert" : "status"} sx={{ width: "100%", maxWidth: 520 }}>{current?.message}</Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}
