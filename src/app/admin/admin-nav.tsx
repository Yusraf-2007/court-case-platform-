"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/cases", label: "Cases", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-maroon text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
