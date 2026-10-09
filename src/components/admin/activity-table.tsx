import Link from "next/link";

import type { Activity } from "@/lib/admin/dashboard";
import { humanize } from "@/lib/format";

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

// Rows of case_audit_log, as written by the database triggers.
export function ActivityTable({ rows, showCase = true }: { rows: (Activity | Omit<Activity, "case_no">)[]; showCase?: boolean }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">No entries yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="ledger">
        <thead>
          <tr>
            <th>When</th>
            {showCase ? <th>Case</th> : null}
            <th>Change</th>
            <th>From</th>
            <th>To</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="dim whitespace-nowrap">{timeFormat.format(a.changed_at)}</td>
              {showCase ? (
                <td className="whitespace-nowrap">
                  {"case_no" in a && a.case_no ? (
                    <Link href={`/admin/cases/${a.case_id}`} className="hover:underline">
                      {a.case_no}
                    </Link>
                  ) : (
                    <span className="dim">Case {a.case_id} (deleted)</span>
                  )}
                </td>
              ) : null}
              <td className="whitespace-nowrap">
                <span className="font-medium">{humanize(a.action)}</span>{" "}
                <span className="dim">
                  {a.table_name.replace(/_/g, " ")}
                  {a.field_changed !== "*" ? ` · ${a.field_changed}` : ""}
                </span>
              </td>
              <td className="max-w-56">
                <AuditValue v={a.old_value} />
              </td>
              <td className="max-w-56">
                <AuditValue v={a.new_value} />
              </td>
              <td className="dim">{a.changed_by ?? "seed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Whole-row values are JSON; show them compactly, in full on hover.
function AuditValue({ v }: { v: string | null }) {
  if (v === null) return <span className="dim">–</span>;
  if (v.startsWith("{")) {
    return (
      <code className="text-muted-foreground block truncate font-mono text-xs" title={v}>
        {v}
      </code>
    );
  }
  return (
    <span className="block truncate" title={v}>
      {v}
    </span>
  );
}
