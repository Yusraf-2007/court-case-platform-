// After a write the admin is redirected with a receipt in the URL: what was
// done, which triggers fired and how many audit rows were written. Every
// part is checked against these lists before it is shown.

export const TRIGGERS: Record<string, string> = {
  cases_log_status_stage: "Logged the change of status or stage",
  cases_log_court: "Logged the transfer to another court",
  cases_fir_only_on_gr: "Checked that only a G.R. case carries an FIR",
  hearings_not_after_disposal: "Checked the hearing is not after disposal",
  orders_dispose_case: "Final order: disposed of the case",
  audit_cases: "Audited the case row",
  audit_case_parties: "Audited the party",
  audit_case_advocates: "Audited the advocate link",
  audit_persons: "Audited the person, on each of their cases",
  audit_hearings: "Audited the hearing",
  audit_orders: "Audited the order",
};

export const DONE: Record<string, string> = {
  case_created: "Case registered.",
  case_saved: "Case saved.",
  case_archived: "Case archived. It no longer appears on public pages.",
  case_restored: "Case restored to the public register.",
  case_deleted: "Case deleted. Its audit history is kept.",
  party_added: "Party added.",
  party_saved: "Party saved.",
  party_removed: "Party removed.",
  hearing_added: "Hearing recorded.",
  hearing_saved: "Hearing saved.",
  hearing_removed: "Hearing deleted.",
  order_added: "Order recorded.",
  order_saved: "Order saved.",
  order_removed: "Order deleted.",
};

export type Receipt = { done: string; fired: string[]; logged: number };

export function receiptQuery(done: keyof typeof DONE, r: { fired: string[]; logged: number }) {
  const q = new URLSearchParams({ done, logged: String(r.logged) });
  if (r.fired.length) q.set("fired", r.fired.join(","));
  return q.toString();
}

export function parseReceipt(params: Record<string, string | string[] | undefined>): Receipt | null {
  const done = typeof params.done === "string" && params.done in DONE ? params.done : null;
  if (!done) return null;
  const fired = typeof params.fired === "string" ? params.fired.split(",").filter((t) => t in TRIGGERS).slice(0, 50) : [];
  const logged = typeof params.logged === "string" && /^\d{1,5}$/.test(params.logged) ? Number(params.logged) : 0;
  return { done, fired, logged };
}
