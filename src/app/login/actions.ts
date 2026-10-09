"use server";

import { redirect } from "next/navigation";

import { authenticateAdmin, endSession, startSession } from "@/lib/auth";
import { writeDb } from "@/lib/db-write";
import { safeNext } from "@/lib/session";

export type LoginState = { error?: string; login?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const login = String(form.get("login") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!login || !password || login.length > 254 || password.length > 256) {
    return { error: "Enter your email or username, and your password.", login };
  }

  const admin = await authenticateAdmin(login, password);
  // One message for every failure, so the form reveals neither which
  // accounts exist nor which are administrators.
  if (!admin) return { error: "Incorrect credentials, or this account is not an administrator.", login };

  await writeDb(admin, (sql) => sql`SELECT app_auth.record_login(${admin.userId})`);
  await startSession(admin);
  redirect(safeNext(form.get("next"), "/admin"));
}

export async function logout() {
  await endSession();
  redirect("/");
}
