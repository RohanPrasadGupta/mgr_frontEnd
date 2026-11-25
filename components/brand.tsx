import Image from "next/image";
import { cx } from "./ui";

// Brand assets live in public/brand (generated from the source logos in public/ with transparent backgrounds).
// Both wordmark colourways are rendered; CSS shows the one that matches the active theme (no JS, no flash).
const WORDMARK_RATIO = 1784 / 292;

/** "MoneyMgr" wordmark sized by height; switches between its dark- and light-background versions with the theme. */
export function Wordmark({ height = 28, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  const width = Math.round(height * WORDMARK_RATIO);
  return (
    <span className={cx("inline-flex shrink-0", className)} role="img" aria-label="MoneyMgr">
      <Image src="/brand/wordmark-on-dark.png" alt="" aria-hidden width={width} height={height} priority={priority} className="logo-on-dark" style={{ height, width: "auto" }} />
      <Image src="/brand/wordmark-on-light.png" alt="" aria-hidden width={width} height={height} priority={priority} className="logo-on-light" style={{ height, width: "auto" }} />
    </span>
  );
}

/** The M-arrow symbol alone (collapsed sidebar, small spaces). */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/brand/mark.png" alt="MoneyMgr" width={size} height={size} className={cx("shrink-0", className)} />;
}
