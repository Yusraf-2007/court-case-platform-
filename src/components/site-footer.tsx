import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="font-display text-kicker uppercase">Court Case Platform</p>
          <p className="text-muted-foreground mt-1 font-serif">
            A student project, not an official government service. Every case, party, hearing and
            order is synthetic; court names and jurisdictions are public reference data. Nothing
            here is legal advice. For a real case, consult the court concerned or eCourts.
          </p>
        </div>
        <nav aria-label="Footer" className="text-muted-foreground flex gap-4">
          <Link href="/cases" className="hover:text-foreground">
            Cases
          </Link>
          <Link href="/search" className="hover:text-foreground">
            Search
          </Link>
          <Link href="/deadlines" className="hover:text-foreground">
            Deadlines
          </Link>
        </nav>
      </div>
    </footer>
  );
}
