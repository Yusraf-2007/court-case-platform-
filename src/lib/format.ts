// Display helpers shared by the case pages.

// "prosecution_evidence" -> "Prosecution evidence"
export const humanize = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// Dates are calendar dates (Postgres `date`), so format them in UTC to avoid
// shifting a day in the viewer's time zone.
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export const formatDate = (d: Date) => dateFormat.format(d);

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "default",
  disposed: "secondary",
  stayed: "outline",
  abated: "destructive",
};
