import { CheckCircle2Icon, ZapIcon } from "lucide-react";

import { DONE, TRIGGERS, type Receipt } from "@/lib/admin/receipt";

// Shown after a write: what was done, which database triggers fired (in
// order, with repeats counted) and how many audit rows were written.
export function WriteReceipt({ receipt }: { receipt: Receipt }) {
  const counts = new Map<string, number>();
  for (const t of receipt.fired) counts.set(t, (counts.get(t) ?? 0) + 1);

  return (
    <section role="status" className="border-success/40 bg-card rounded-sm border border-l-4 px-5 py-4">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2Icon className="text-success size-4" aria-hidden />
        {DONE[receipt.done]}
        <span className="text-muted-foreground ml-auto text-sm font-normal tabular-nums">
          {receipt.logged} audit {receipt.logged === 1 ? "entry" : "entries"} written
        </span>
      </p>
      <div className="mt-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Triggers fired</p>
        {counts.size ? (
          <ul className="mt-1.5 grid gap-1 text-sm">
            {[...counts].map(([name, n]) => (
              <li key={name} className="flex items-baseline gap-2">
                <ZapIcon className="text-maroon size-3.5 shrink-0 translate-y-0.5" aria-hidden />
                <code className="font-mono text-[0.8rem]">{name}</code>
                {n > 1 ? <span className="text-muted-foreground tabular-nums">×{n}</span> : null}
                <span className="text-muted-foreground">– {TRIGGERS[name]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">None.</p>
        )}
      </div>
    </section>
  );
}
