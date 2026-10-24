import { BookOpen, ChartNoAxesColumn, History, House } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/history", label: "History", icon: History },
  { href: "/insights", label: "Insights", icon: ChartNoAxesColumn },
];

// A nav link stays highlighted on its detail pages too: person and group
// pages belong to the Library.
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/library")
    return (
      pathname === "/library" ||
      pathname.startsWith("/persons") ||
      pathname.startsWith("/groups") ||
      pathname === "/add"
    );
  return pathname === href || pathname.startsWith(`${href}/`);
}
