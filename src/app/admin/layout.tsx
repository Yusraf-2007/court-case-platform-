import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { AdminNav } from "./admin-nav";

// Chrome for the admin area. Access is enforced by the middleware and by
// requireAdmin() in every page and action, not by this layout.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="bg-card border-border border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <span className="font-display text-maroon text-kicker hidden uppercase sm:inline">Administration</span>
            <AdminNav />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/cases/new">
              <PlusIcon /> Register a case
            </Link>
          </Button>
        </div>
      </div>
      {children}
    </>
  );
}
