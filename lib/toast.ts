export type ToastKind = "success" | "error" | "info";
type Listener = (kind: ToastKind, message: string) => void;
const listeners = new Set<Listener>();

/** Tiny bus so non-React code (the QueryClient's mutation cache) can raise toasts the <FeedbackProvider> renders. */
export const toast = {
  success: (m: string) => emit("success", m),
  error: (m: string) => emit("error", m),
  info: (m: string) => emit("info", m),
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};
function emit(kind: ToastKind, message: string) { listeners.forEach((l) => l(kind, message)); }
