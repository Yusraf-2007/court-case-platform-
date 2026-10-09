import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

import { logout } from "@/app/login/actions";
import { NavLinks } from "@/components/nav-links";
import { Seal } from "@/components/seal";
import { getSession } from "@/lib/auth";

// Header for every page. The admin menu is a native <details> disclosure, so
// it works without client JavaScript. Display only: what it shows comes from
// the cookie; the admin pages themselves re-check access with requireAdmin().
export async function SiteHeader() {
  const session = await getSession();
  const admin = session?.role === "admin" ? session : null;

  return (
    <header className="bg-ink text-ink-foreground border-brass/60 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <Seal className="size-10 transition-transform duration-700 group-hover:rotate-12" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[1.05rem] font-semibold tracking-[0.12em]">Court Case Platform</span>
            <span className="text-ink-foreground/60 font-serif text-xs italic">Criminal Case Registry · Courts of India</span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-4">
          <NavLinks />
          {admin ? (
            <details className="group relative">
              <summary className="border-brass/50 hover:bg-ink-foreground/10 flex cursor-pointer list-none items-center gap-1.5 rounded-sm border px-3 py-1 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-display text-[0.75rem] tracking-[0.14em] uppercase">Admin</span>
                <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="bg-card text-card-foreground border-border absolute right-0 z-20 mt-2 w-56 rounded-sm border py-1 shadow-lg">
                <p className="text-muted-foreground border-border border-b px-3 py-2 text-xs">
                  Signed in as <span className="text-foreground font-medium">{admin.username}</span>
                </p>
                <Link href="/admin" className="hover:bg-muted block px-3 py-2 text-sm">
                  Dashboard
                </Link>
                <Link href="/admin/cases/new" className="hover:bg-muted block px-3 py-2 text-sm">
                  Register a case
                </Link>
                <form action={logout} className="border-border border-t">
                  <button type="submit" className="hover:bg-muted w-full px-3 py-2 text-left text-sm">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link
              href="/login"
              className="border-brass/50 hover:bg-ink-foreground/10 font-display rounded-sm border px-3 py-1 text-[0.75rem] tracking-[0.14em] uppercase"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
