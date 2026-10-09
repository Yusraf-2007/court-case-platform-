"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/cases", label: "Cases" },
  { href: "/search", label: "Search" },
  { href: "/deadlines", label: "Deadlines" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1 sm:gap-2">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "font-display relative px-2 py-1 text-[0.8rem] tracking-[0.14em] uppercase transition-colors sm:px-3",
                "text-ink-foreground/75 hover:text-ink-foreground",
                "after:bg-brass after:absolute after:inset-x-2 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:transition-transform after:duration-500 sm:after:inset-x-3",
                active && "text-ink-foreground after:scale-x-100",
              )}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
