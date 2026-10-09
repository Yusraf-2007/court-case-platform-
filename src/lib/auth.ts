import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type Role,
  type Session,
} from "@/lib/session";

// Check a username and password in the database. The app never sees a
// password hash: app_auth.authenticate() returns only id, name and role.
export async function authenticate(username: string, password: string): Promise<Session | null> {
  const rows = await db()<{ user_id: string; username: string; role: Role }[]>`
    SELECT user_id, username, role FROM app_auth.authenticate(${username}, ${password})`;
  if (rows.length === 0) return null;
  return { userId: Number(rows[0].user_id), username: rows[0].username, role: rows[0].role };
}

export async function startSession(s: Session) {
  (await cookies()).set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

// Any signed-in user. Middleware already redirects anonymous requests; this
// is the second check, inside the page or action itself.
export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

// An admin, confirmed against the database rather than trusted from the
// token alone, so a demoted or disabled user loses write access at once.
export async function requireAdmin(): Promise<Session> {
  const s = await requireUser();
  const [row] = await db()<{ role: Role | null }[]>`
    SELECT app_auth.current_role_of(${s.userId}) AS role`;
  if (row?.role !== "admin") redirect("/cases?denied=1");
  return s;
}
