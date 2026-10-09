import type { Metadata } from "next";
import Link from "next/link";

import { ActivityTable } from "@/components/admin/activity-table";
import { Figure, PageHead, Panel, Status } from "@/components/admin/admin-ui";
import { getDashboard, type Tally } from "@/lib/admin/dashboard";
import { requireAdmin } from "@/lib/auth";
import { formatDate, humanize } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const admin = await requireAdmin();
  const d = await getDashboard();
  const pendingDeadlines = d.deadlines.length;
  const rulesLine = `${d.rules.verified} of ${d.rules.total} limitation rules verified.`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <PageHead
        kicker="Dashboard"
        title="The register at a glance"
        sub={`Signed in as ${admin.username}. Archived cases are left out of every figure except their own.`}
      />

      <dl className="bg-card border-border [&>div]:border-border grid grid-cols-2 rounded-sm border sm:grid-cols-5 [&>div]:border-b sm:[&>div]:border-b-0 sm:[&>div+div]:border-l">
        <Figure value={d.totals.live} label="Cases" note="On the public register" />
        <Figure value={d.totals.pending} label="Pending" tone="accent" />
        <Figure value={d.totals.disposed} label="Disposed" />
        <Figure value={d.totals.archived} label="Archived" note="Hidden from public pages" />
        <Figure
          value={pendingDeadlines}
          label="Pending deadlines"
          note={d.rules.verified === 0 ? `${rulesLine} Deadlines are not computed until a rule is marked verified.` : rulesLine}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="By court" sub="Courts with at least one case.">
          <TallyTable rows={d.byCourt} label="Court" link={(r) => `/admin/cases?court=${r.key}`} />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="By status">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Status</th>
                  <th className="num">Cases</th>
                </tr>
              </thead>
              <tbody>
                {d.byStatus.map((s) => (
                  <tr key={s.status}>
                    <td>
                      <Link href={`/admin/cases?status=${s.status}`} className="hover:underline">
                        <Status value={s.status} />
                      </Link>
                    </td>
                    <td className="num">{s.n}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{d.byStatus.reduce((a, s) => a + s.n, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </Panel>

          <Panel title="Pending deadlines" sub="Appeals and revisions still in time.">
            {pendingDeadlines === 0 ? (
              <div className="border-maroon/50 border-l-2 pl-4">
                <p className="font-serif text-lg">0 pending. {rulesLine}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {d.rules.verified === 0
                    ? "Deadlines are not computed until a rule is marked verified, so zero means none computed, not none due."
                    : "No final order has a remedy still in time."}{" "}
                  <Link href="/deadlines" className="text-maroon hover:underline">
                    See the rules
                  </Link>
                </p>
              </div>
            ) : (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Remedy</th>
                    <th className="num">Deadline</th>
                    <th className="num">Days left</th>
                  </tr>
                </thead>
                <tbody>
                  {d.deadlines.slice(0, 10).map((x) => (
                    <tr key={`${x.case_id}-${x.remedy}-${x.trigger_event}`}>
                      <td>
                        <Link href={`/admin/cases/${x.case_id}`} className="font-medium hover:underline">
                          {x.case_no}
                        </Link>
                      </td>
                      <td>{humanize(x.remedy)}</td>
                      <td className="num">{formatDate(x.deadline)}</td>
                      <td className="num">{x.days_left}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="By case type">
        <TallyTable rows={d.byType} label="Register" link={(r) => `/admin/cases?type=${r.key}`} />
      </Panel>

      <Panel title="Recent activity" sub="The latest entries in case_audit_log, written by the database triggers.">
        <ActivityTable rows={d.activity} />
      </Panel>
    </main>
  );
}

function TallyTable({ rows, label, link }: { rows: Tally[]; label: string; link: (r: Tally) => string }) {
  const sum = (k: "pending" | "disposed" | "other" | "total") => rows.reduce((a, r) => a + r[k], 0);
  const cell = (n: number) => (n ? n : <span className="dim">–</span>);
  return (
    <div className="overflow-x-auto">
      <table className="ledger">
        <thead>
          <tr>
            <th>{label}</th>
            <th className="num">Pending</th>
            <th className="num">Disposed</th>
            <th className="num">Other</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <Link href={link(r)} className="hover:underline">
                  {r.label}
                </Link>
              </td>
              <td className="num">{cell(r.pending)}</td>
              <td className="num">{cell(r.disposed)}</td>
              <td className="num">{cell(r.other)}</td>
              <td className="num font-semibold">{r.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{sum("pending")}</td>
            <td className="num">{sum("disposed")}</td>
            <td className="num">{sum("other")}</td>
            <td className="num">{sum("total")}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
