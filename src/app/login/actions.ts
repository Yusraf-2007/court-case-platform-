"use server";

import { redirect } from "next/navigation";

import { authenticate, endSession, startSession } from "@/lib/auth";
import { safeNext } from "@/lib/session";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password || username.length > 64 || password.length > 256) {
    return { error: "Enter your username and password.", username };
  }

  const session = await authenticate(username, password);
  // One message for both cases, so the form does not reveal which usernames exist.
  if (!session) return { error: "Incorrect username or password.", username };

  await startSession(session);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
