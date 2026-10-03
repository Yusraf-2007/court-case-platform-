import { Badge } from "@/components/ui/badge";
import type { Party } from "@/lib/case-detail";
import { humanize } from "@/lib/format";

function PartyCard({ party }: { party: Party }) {
  const address = [party.address, party.district].filter(Boolean).join(", ");
  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{party.full_name}</span>
        {party.kind !== "individual" ? <Badge variant="outline">{humanize(party.kind)}</Badge> : null}
      </div>
      {party.relation || address || party.through_name ? (
        <p className="text-muted-foreground mt-0.5 text-sm">
          {[
            party.relation ? `${party.relation} ${party.relative_name}` : null,
            address || null,
            party.through_name ? `through ${party.through_name}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      {party.advocates.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {party.advocates.map((a) => (
            <li key={a.name} className="flex flex-wrap items-center gap-2 text-sm">
              <span>Adv. {a.name}</span>
              {a.capacity === "public_prosecutor" ? <Badge variant="secondary">APP</Badge> : null}
              {a.enrolment ? (
                <span className="text-muted-foreground font-mono text-xs">{a.enrolment}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">No advocate recorded</p>
      )}
    </li>
  );
}

export function Parties({ parties }: { parties: Party[] }) {
  if (parties.length === 0) {
    return <p className="text-muted-foreground text-sm">No parties are named in the records.</p>;
  }

  // Rows arrive in party_role order, so grouping preserves that order.
  const groups = new Map<string, Party[]>();
  for (const p of parties) groups.set(p.role, [...(groups.get(p.role) ?? []), p]);

  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([role, members]) => (
        <section key={role} className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {humanize(role)}
          </h3>
          <ul className="flex flex-col gap-2">
            {members.map((p) => (
              <PartyCard key={p.id} party={p} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
