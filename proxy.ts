import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only (cookie presence). Real authorization happens in the API on every call.
const PUBLIC = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = req.cookies.has("mm_rt");
  const isPublic = PUBLIC.some((p) => pathname === p);
  if (!signedIn && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (signedIn && isPublic) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
