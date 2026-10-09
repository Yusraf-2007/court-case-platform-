import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

// First line of access control: every page except /login needs a valid
// session, and the case editing pages need an admin one. Pages and server
// actions check again themselves (src/lib/auth.ts), and admin writes
// re-check the role in the database.
const ADMIN_ONLY = [/^\/cases\/new\/?$/, /^\/cases\/\d+\/edit\/?$/];

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(login);
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE); // expired or forged
    return res;
  }

  if (session.role !== "admin" && ADMIN_ONLY.some((re) => re.test(pathname))) {
    return NextResponse.redirect(new URL("/cases?denied=1", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
