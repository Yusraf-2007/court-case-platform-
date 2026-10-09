import Link from "next/link";
import { LogOutIcon } from "lucide-react";

import { logout } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export async function SiteHeader() {
  const session = await getSession();
  if (!session) return null;

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/cases" className="font-semibold tracking-tight">
          Court Case Platform
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm">{session.username}</span>
          <Badge variant={session.role === "admin" ? "default" : "secondary"}>
            {session.role === "admin" ? "Admin" : "Viewer"}
          </Badge>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOutIcon /> Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
