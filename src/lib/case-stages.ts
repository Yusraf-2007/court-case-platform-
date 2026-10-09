import { STAGES, type StageKey } from "@/lib/stages";

// One case's progress through its lifecycle, built from the case row and
// db/queries/case_stages.sql. The public stage tree and the admin stage
// table both render this; only the presentation differs.

export type StageEvent = {
  stage: StageKey;
  reached_on: Date;
  order_id: string | null;
  order_type: string | null;
  order_text: string | null;
  judge: string | null;
};

export type StageState =
  | "done" // reached
  | "current" // where the case is now
  | "upcoming" // still ahead
  | "skipped"; // never reached: the case closed before it

export type StageRow = {
  key: StageKey;
  numeral: string;
  title: string;
  plain: string;
  state: StageState;
  reachedOn: Date | null; // null: reached, but no date on record
  daysInStage: number | null; // until the next stage, or until today for the current one
  order: { id: string; type: string; text: string; judge: string | null } | null;
};

export type CaseProgress = {
  path: "trial" | "short";
  rows: StageRow[];
  current: StageRow | null; // null once the case is closed
  closed: boolean;
  closedEarly: boolean; // closed without passing every stage
};

type CaseFacts = {
  status: string;
  stage: string | null;
  is_appellate: boolean;
  disposed_by: "judgment" | "order";
};

// Appeals, revisions and applications do not go through a trial. They are
// shown on a short path that reuses the enum values with plainer names.
const SHORT_PATH: { key: StageKey; title: string; plain: string }[] = [
  { key: "institution", title: "Filed", plain: "The appeal, revision or application is filed." },
  { key: "registration", title: "Registered", plain: "The court enters it in its register and gives it a number." },
  { key: "final_arguments", title: "Hearing", plain: "The court hears both sides." },
  { key: "judgment", title: "Decision", plain: "The court decides the matter." },
  { key: "disposal", title: "Disposal", plain: "The matter is closed in this court." },
];

const DAY = 86_400_000;
const days = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);

export function buildStages(c: CaseFacts, events: StageEvent[], today = new Date()): CaseProgress {
  const trial = !c.is_appellate && c.disposed_by === "judgment";
  const path = trial
    ? STAGES.map(({ key, title, plain }) => ({ key, title, plain }))
    : SHORT_PATH;
  const byStage = new Map(events.map((e) => [e.stage, e]));
  // On the short path the final order is the decision.
  if (!trial && !byStage.has("judgment") && byStage.has("disposal")) {
    byStage.set("judgment", { ...byStage.get("disposal")!, stage: "judgment" });
  }

  const last = path.length - 1; // disposal
  // A case on the register was instituted and registered (stages 0 and 1),
  // dated or not; beyond that, only a dated stage proves it was reached.
  const lastReached = path.reduce((acc, s, i) => (i < last && byStage.has(s.key) ? i : acc), 1);
  const closed = c.status === "disposed" || c.status === "abated";

  let states: StageState[];
  if (closed) {
    // A judgment means every stage before it was passed, dated or not.
    // Without one, the case closed at its last dated stage.
    const judgment = path.findIndex((s) => s.key === "judgment");
    const reachedUpTo = byStage.has("judgment") ? judgment : lastReached;
    states = path.map((_, i) => (i === last || i <= reachedUpTo ? "done" : "skipped"));
  } else {
    // With no stage on record, show what is proven and claim no position.
    const cur = path.findIndex((s) => s.key === c.stage);
    states = path.map((_, i) =>
      cur === -1 ? (i <= lastReached ? "done" : "upcoming") : i < cur ? "done" : i === cur ? "current" : "upcoming",
    );
  }

  const rows: StageRow[] = path.map((s, i) => {
    const e = byStage.get(s.key);
    return {
      key: s.key,
      numeral: toRoman(i + 1),
      title: s.title,
      plain: s.plain,
      state: states[i],
      reachedOn: states[i] === "done" || states[i] === "current" ? (e?.reached_on ?? null) : null,
      daysInStage: null,
      order: e?.order_id ? { id: e.order_id, type: e.order_type!, text: e.order_text!, judge: e.judge } : null,
    };
  });

  // Days in a stage: from reaching it to reaching the next stage (both must
  // be dated), or to today for the stage the case is in now.
  rows.forEach((r, i) => {
    if (!r.reachedOn) return;
    if (r.state === "current") r.daysInStage = days(r.reachedOn, today);
    else if (r.state === "done" && i < last) {
      const next = rows[i + 1];
      if (next.reachedOn && (next.state === "done" || next.state === "current")) r.daysInStage = days(r.reachedOn, next.reachedOn);
    }
  });

  return {
    path: trial ? "trial" : "short",
    rows,
    current: rows.find((r) => r.state === "current") ?? null,
    closed,
    closedEarly: states.includes("skipped"),
  };
}

function toRoman(n: number) {
  const table: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}
