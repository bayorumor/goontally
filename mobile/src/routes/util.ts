export { parseId } from "@/lib/ids";
// Like Next's: shows the route's error view as a 404.
export { notFound } from "next/navigation";

// The phone knows its own timezone; the web app needs a cookie for this.
export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
