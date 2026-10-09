import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readDb } from "@/lib/db-read";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type Role,
  type Session,
} from "@/lib/session";

// Sign-in is for administrators only; public pages need no account.
// The 'viewer' role still exists in app_auth.user_role, unused, reserved for
// a future litigant portal (see CLAUDE.md).

// An admin session confirmed against the database in this request. The brand
// makes it impossible to construct outside this module, and db-write.ts
// accepts nothing else.
declare const adminBrand: unique symbol;
export type AdminSession = Session & { role: "admin"; readonly [adminBrand]: true };

const asAdmin = (s: Session) => s as AdminSession;

// Check credentials in the database. The app never sees a password hash:
// app_auth.authenticate() returns only id, name and role. Accepts a username
// or an email address. Returns null unless the user is an enabled admin.
export async function authenticateAdmin(login: string, password: string): Promise<AdminSession | null> {
  const rows = await readDb()<{ user_id: string; username: string; role: Role }[]>`
    SELECT user_id, username, role FROM app_auth.authenticate(${login}, ${password})`;
  const u = rows[0];
  if (!u || u.role !== "admin") return null;
  return asAdmin({ userId: Number(u.user_id), username: u.username, role: "admin" });
}

export async function startSession(s: AdminSession) {
  (await cookies()).set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    // Always secure: browsers treat http://localhost as a secure context, so
    // this still works in local development.
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// The signed-in user per the cookie alone (no database check). Fine for
// display, such as the header's admin menu; never for authorising a write.
export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

// Gate for every admin page, server action and route handler. Middleware
// already blocks /admin without a valid cookie; this re-checks inside the
// handler and re-reads the role from the database, so a demoted or disabled
// admin loses access immediately rather than when the cookie expires.
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  const [row] = await readDb()<{ role: Role | null }[]>`
    SELECT app_auth.current_role_of(${s.userId}) AS role`;
  if (row?.role !== "admin") {
    await endSession();
    redirect("/login?revoked=1");
  }
  return asAdmin(s);
}
