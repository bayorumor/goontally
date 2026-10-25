// Positive integer id from a route param, or null.
export function parseId(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Like next/navigation's notFound(): shows the route's error view as a 404.
export function notFound(): never {
  throw new Response("Not found", { status: 404 });
}

// The phone knows its own timezone; the web app needs a cookie for this.
export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
