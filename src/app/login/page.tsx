import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Seal } from "@/components/seal";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Administrator sign-in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if ((await getSession())?.role === "admin" && !params.revoked) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="rise-in w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Seal className="size-20" />
          <div>
            <p className="font-display text-maroon text-kicker uppercase">Registry</p>
            <h1 className="font-serif text-3xl font-semibold">Administrator sign-in</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Case records are public. Sign-in is only for court staff who maintain them.
            </p>
          </div>
        </div>
        {params.revoked ? (
          <p role="alert" className="border-border bg-card mb-4 rounded-md border px-4 py-3 text-sm">
            Your administrator access has ended. Sign in again if it has been restored.
          </p>
        ) : null}
        <div className="bg-card border-border rounded-md border p-6 shadow-sm">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
