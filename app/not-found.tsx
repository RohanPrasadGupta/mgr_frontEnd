import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-sm space-y-3 text-center">
        <p className="text-5xl font-semibold text-muted">404</p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted">That page doesn’t exist or has moved.</p>
        <Link href="/" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">Go to dashboard</Link>
      </div>
    </main>
  );
}
