import "server-only";
import { cookies } from "next/headers";
import { resolveTimeZone, TZ_COOKIE } from "./timezone";

// The viewer's timezone as reported by <TimezoneCookie />, or UTC on the very
// first visit before the cookie exists.
export async function getViewerTimeZone() {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  return resolveTimeZone(value ? decodeURIComponent(value) : null);
}
