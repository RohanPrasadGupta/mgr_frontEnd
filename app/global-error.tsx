"use client";

// Last line of defence: replaces the root layout, so it brings its own <html>, <body> and minimal styles.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <style>{`body{background:#f6f7f9;color:#14161a}@media(prefers-color-scheme:dark){body{background:#0e1013;color:#eceef2}}`}</style>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 20 }}>MoneyMgr hit an unexpected error</h1>
            <p style={{ opacity: 0.7, fontSize: 14 }}>Please try again. If it keeps happening, reload the page.</p>
            <button onClick={() => retry()} style={{ padding: "8px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", fontSize: 14, cursor: "pointer" }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
