import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

// First line of access control for the admin area. Public pages (/, /cases,
// /cases/[id], /search, /deadlines) are open and never reach this.
// Every admin page, action and route handler checks again with
// requireAdmin() (src/lib/auth.ts), which also re-reads the role from the
// database.
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session?.role === "admin") return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.redirect(login);
  if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE); // expired or forged
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
