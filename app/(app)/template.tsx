// A template (unlike a layout) re-mounts on every navigation, so each page arrives with the same short fade-up.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
