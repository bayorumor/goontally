export const TZ_COOKIE = "tz";

// A valid IANA timezone name, or UTC when missing/unknown.
export function resolveTimeZone(tz: string | null | undefined) {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// "YYYY-MM-DD" / "YYYY-MM" for a date as seen in the given timezone.
export function localDateParts(d: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
  };
}
