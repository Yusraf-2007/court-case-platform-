import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

// Placeholder until the admin dashboard (step 4) replaces it.
export default async function AdminHome() {
  const admin = await requireAdmin();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="font-display text-brass text-xs tracking-[0.25em] uppercase">Administration</p>
        <h1 className="font-serif text-4xl font-semibold">Welcome, {admin.username}</h1>
        <p className="text-muted-foreground mt-2">The full dashboard is the next build step.</p>
      </div>
      <div>
        <Button asChild>
          <Link href="/admin/cases/new">Register a case</Link>
        </Button>
      </div>
    </main>
  );
}
