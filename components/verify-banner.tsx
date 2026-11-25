"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { useMe, useMutate } from "@/lib/api/hooks";

/** Shown until the address is confirmed: without it, a forgotten password can't be recovered. */
export function VerifyBanner() {
  const { data: me } = useMe();
  const [hidden, setHidden] = useState(false);
  const resend = useMutate(() => call(client.POST("/me/resend-verification")), async () => {}, "Verification email sent — check your inbox");
  if (!me || me.emailVerified || hidden) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-primary/30 bg-primary/10 px-4 py-2 text-center text-sm">
      <span>Please confirm <strong>{me.email}</strong> so you can recover your account if you forget the password.</span>
      <span className="flex gap-3">
        <button type="button" onClick={() => resend.mutate(undefined as never)} disabled={resend.isPending || resend.isSuccess} className="font-medium text-primary underline disabled:no-underline disabled:opacity-60">
          {resend.isSuccess ? "Sent" : resend.isPending ? "Sending…" : "Resend email"}
        </button>
        <button type="button" onClick={() => setHidden(true)} className="text-muted underline">Later</button>
      </span>
    </div>
  );
}
