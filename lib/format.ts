// Dates are formatted with an explicit timezone so server-rendered HTML and
// the browser produce the same text.
export const formatDateTime = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });

// Short "when" label for stat tiles: Today, Yesterday, 3d ago, or "24 Oct".
export function relativeDay(iso: string, timeZone: string) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
  const days = Math.round(
    (Date.parse(day(new Date())) - Date.parse(day(new Date(iso)))) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone,
  });
}
