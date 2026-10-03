import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CaseNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Case not found</h1>
      <p className="text-muted-foreground text-sm">There is no case with this id.</p>
      <Button asChild variant="outline">
        <Link href="/cases">Back to all cases</Link>
      </Button>
    </main>
  );
}
