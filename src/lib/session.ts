// Session tokens: a JWT (HS256) in an httpOnly cookie. Used by middleware
// (edge runtime) and server code, so it depends only on `jose`.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours, in seconds

export type Role = "viewer" | "admin";
export type Session = { userId: number; username: string; role: Role };

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters.");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ username: s.username, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

// Returns null for a missing, expired, tampered or malformed token.
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    const { username, role } = payload;
    if (!Number.isSafeInteger(userId) || typeof username !== "string") return null;
    if (role !== "viewer" && role !== "admin") return null;
    return { userId, username, role };
  } catch {
    return null;
  }
}

// Only same-site paths are allowed as post-login redirects.
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/cases";
}
