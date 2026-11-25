import Link from "next/link";
import { Wordmark } from "@/components/brand";

// Public pages (no sign-in): the app stores link here from the listings and from inside the apps.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link href="/" aria-label="MoneyMgr home"><Wordmark height={30} /></Link>
      <article className="legal mt-8 space-y-4 text-[15px] leading-relaxed">{children}</article>
      <footer className="mt-12 flex gap-4 border-t border-border pt-4 text-sm text-muted">
        <Link href="/privacy" className="hover:text-fg">Privacy policy</Link>
        <Link href="/delete-account" className="hover:text-fg">Delete your account</Link>
      </footer>
    </div>
  );
}
