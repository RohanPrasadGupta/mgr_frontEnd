import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only (cookie presence). Real authorization happens in the API on every call.
const SIGNED_OUT_ONLY = ["/login", "/register", "/forgot-password"];
/** Reachable either way: they arrive from an email link and work on a token, not a session. */
const OPEN = ["/reset-password", "/verify-email"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN.includes(pathname)) return NextResponse.next();
  const signedIn = req.cookies.has("mm_rt");
  const isPublic = SIGNED_OUT_ONLY.includes(pathname);
  if (!signedIn && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (signedIn && isPublic) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
